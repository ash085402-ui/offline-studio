import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, EllipsisVertical,
  Cpu, Database, FileSpreadsheet, FileText, HardDrive, LockKeyhole, Menu, Pencil,
  Plus, Printer, Search, ShieldCheck, Sparkles, Upload, X
} from 'lucide-react'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './App.css'
import './responsive.css'

const DB_NAME = 'offline-studio-v10'
const DB_VERSION = 1
const FILE_STORE = 'files'
const CONFIG_STORE = 'config'
const FILE_CATEGORIES = [
  { id: 'Word', label: 'Word', kinds: ['Word'] },
  { id: 'PDF', label: 'PDF', kinds: ['PDF'] },
  { id: 'Excel', label: 'Excel', kinds: ['Excel'] },
  { id: 'other', label: 'Այլ փաստաթղթեր', kinds: ['Փաստաթուղթ', 'PNG'] },
]
const PAPER_SIZES = {
  A4: { label: 'A4', width: 210, height: 297 },
  Letter: { label: 'Letter', width: 216, height: 279 },
  Legal: { label: 'Legal', width: 216, height: 356 },
}

function parsePageRange(value, pageCount) {
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === 'all' || normalized === 'բոլորը') {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages = new Set()
  for (const part of normalized.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) return null
    const start = Number(match[1])
    const end = Number(match[2] || match[1])
    if (start < 1 || end < start || end > pageCount) return null
    for (let page = start; page <= end; page += 1) pages.add(page)
  }
  return [...pages].sort((a, b) => a - b)
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(FILE_STORE)) database.createObjectStore(FILE_STORE, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(CONFIG_STORE)) database.createObjectStore(CONFIG_STORE, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function storeRequest(storeName, mode, action) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = action(transaction.objectStore(storeName))
    let result
    request.onsuccess = () => { result = request.result }
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => {
      database.close()
      resolve(result)
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error || new Error('IndexedDB transaction aborted'))
    }
  })
}

const putFile = (file) => storeRequest(FILE_STORE, 'readwrite', (store) => store.put(file))
const getFile = (id) => storeRequest(FILE_STORE, 'readonly', (store) => store.get(id))
const listFiles = () => storeRequest(FILE_STORE, 'readonly', (store) => store.getAll())
const deleteFile = (id) => storeRequest(FILE_STORE, 'readwrite', (store) => store.delete(id))
const getConfig = (key) => storeRequest(CONFIG_STORE, 'readonly', (store) => store.get(key))
const setConfig = (key, value) => storeRequest(CONFIG_STORE, 'readwrite', (store) => store.put({ key, value }))
const removeConfig = (key) => storeRequest(CONFIG_STORE, 'readwrite', (store) => store.delete(key))

function classifyFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'PDF'
  if (ext === 'png') return 'PNG'
  if (['docx', 'doc'].includes(ext)) return 'Word'
  if (['xlsx', 'xls'].includes(ext)) return 'Excel'
  return 'Փաստաթուղթ'
}

function formatBytes(bytes = 0) {
  if (!bytes) return '0 Բ'
  const units = ['Բ', 'ԿԲ', 'ՄԲ', 'ԳԲ']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

async function hashPin(pin) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function blobFromRecord(record) {
  if (record.blob instanceof Blob) return record.blob
  if (record.file instanceof Blob) return record.file
  if (record.buffer instanceof Blob) return record.buffer
  if (record.buffer instanceof ArrayBuffer || ArrayBuffer.isView(record.buffer)) {
    return new Blob([record.buffer], { type: record.type || 'application/octet-stream' })
  }
  return null
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('FileReader returned an unsupported result'))
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
      reader.onabort = () => reject(new Error('File reading was aborted'))
      reader.readAsDataURL(blob)
    } catch (error) {
      reject(error)
    }
  })
}

function arrayBufferToDataUrl(buffer, type) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return `data:${type || 'application/octet-stream'};base64,${btoa(binary)}`
}

async function createSafeFileUrl(blob) {
  try {
    if (typeof URL.createObjectURL === 'function') return URL.createObjectURL(blob)
  } catch {
  }

  try {
    return await readBlobAsDataUrl(blob)
  } catch {
  }

  try {
    return arrayBufferToDataUrl(await blob.arrayBuffer(), blob.type)
  } catch {
    return null
  }
}

function revokeFileUrl(url) {
  if (!url?.startsWith('blob:')) return
  try {
    URL.revokeObjectURL(url)
  } catch {
  }
}

function clearDocumentHighlights(root) {
  root.querySelectorAll('mark.document-find-hit').forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent || ''))
  })
  root.normalize()
}

function highlightDocumentMatches(root, query, activeIndex) {
  clearDocumentHighlights(root)
  if (!query) return 0

  const matcher = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes = []
  while (walker.nextNode()) textNodes.push(walker.currentNode)

  let matchIndex = 0
  for (const textNode of textNodes) {
    const text = textNode.nodeValue || ''
    matcher.lastIndex = 0
    let match
    let cursor = 0
    const fragment = document.createDocumentFragment()
    while ((match = matcher.exec(text))) {
      fragment.append(document.createTextNode(text.slice(cursor, match.index)))
      const mark = document.createElement('mark')
      mark.className = `document-find-hit${matchIndex === activeIndex ? ' is-active' : ''}`
      mark.textContent = match[0]
      fragment.append(mark)
      cursor = match.index + match[0].length
      matchIndex += 1
    }
    if (cursor) {
      fragment.append(document.createTextNode(text.slice(cursor)))
      textNode.replaceWith(fragment)
    }
  }

  root.querySelector('mark.document-find-hit.is-active')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return matchIndex
}

function decorateSelection(style, wordsOnly = false) {
  const selection = window.getSelection()
  if (!selection?.rangeCount || selection.isCollapsed) return false

  const range = selection.getRangeAt(0)
  const fragment = range.extractContents()
  if (wordsOnly) {
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    for (const node of nodes) {
      const parts = node.nodeValue.match(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_]+/gu) || []
      const replacement = document.createDocumentFragment()
      for (const part of parts) {
        if (!/[\p{L}\p{N}_]/u.test(part)) {
          replacement.append(document.createTextNode(part))
          continue
        }
        const span = document.createElement('span')
        span.style.textDecorationLine = 'underline'
        span.style.textDecorationStyle = style
        span.textContent = part
        replacement.append(span)
      }
      node.replaceWith(replacement)
    }
    range.insertNode(fragment)
  } else {
    const span = document.createElement('span')
    span.style.textDecorationLine = 'underline'
    span.style.textDecorationStyle = style
    span.append(fragment)
    range.insertNode(span)
  }

  selection.removeAllRanges()
  return true
}

export default function App() {
  const [activeView, setActiveView] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [fileDrawerOpen, setFileDrawerOpen] = useState(false)
  const [files, setFiles] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [openFileMenuId, setOpenFileMenuId] = useState(null)
  const [openCategories, setOpenCategories] = useState({})
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pageCount, setPageCount] = useState(1)
  const [previewPage, setPreviewPage] = useState(1)
  const [pageRange, setPageRange] = useState('all')
  const [copies, setCopies] = useState(1)
  const [paperSize, setPaperSize] = useState('A4')
  const [editing, setEditing] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [pinHash, setPinHash] = useState('')
  const [locked, setLocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinSetup, setPinSetup] = useState('')
  const [resourceMemory, setResourceMemory] = useState(0)
  const [textContent, setTextContent] = useState('')
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocText, setNewDocText] = useState('')
  const [newDocFormat, setNewDocFormat] = useState('docx')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [findMode, setFindMode] = useState('find')
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [goToPage, setGoToPage] = useState('1')
  const [findIndex, setFindIndex] = useState(0)
  const [findCount, setFindCount] = useState(0)
  const memoryFilesRef = useRef(new Map())
  const objectUrlsRef = useRef(new Map())
  const viewerRef = useRef(null)
  const previewRef = useRef(null)
  const fileMenuRef = useRef(null)

  useEffect(() => {
    if (!openFileMenuId) return undefined

    const closeOnOutsideClick = (event) => {
      if (!fileMenuRef.current?.contains(event.target)) setOpenFileMenuId(null)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenFileMenuId(null)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openFileMenuId])
  const fileInputRef = useRef(null)
  const findInputRef = useRef(null)

  const refreshFiles = useCallback(async () => {
    let storedRecords = []
    try {
      storedRecords = await listFiles()
    } catch (error) {
      console.warn('IndexedDB is unavailable; using in-memory files.', error)
    }
    const recordsById = new Map(storedRecords.map((record) => [record.id, record]))
    for (const [id, record] of memoryFilesRef.current) {
      recordsById.set(id, record)
    }
    const records = [...recordsById.values()]
    records.sort((a, b) => b.addedAt - a.addedAt)
    setFiles(records)
  }, [])

  const saveFileRecord = (record) => {
    memoryFilesRef.current.set(record.id, record)
    const persistedRecord = { ...record }
    delete persistedRecord.fileUrl
    try {
      void putFile(persistedRecord).catch(() => {})
    } catch (error) {
      console.warn('IndexedDB save skipped; keeping the file for this session.', error)
    }
  }

  const getFileUrl = async (record) => {
    const currentUrl = objectUrlsRef.current.get(record.id)
    if (currentUrl) return currentUrl
    if (record.fileUrl?.startsWith('blob:') || record.fileUrl?.startsWith('data:')) {
      objectUrlsRef.current.set(record.id, record.fileUrl)
      return record.fileUrl
    }
    const blob = blobFromRecord(record)
    if (!blob) return null
    const fileUrl = await createSafeFileUrl(blob)
    if (!fileUrl) return null
    objectUrlsRef.current.set(record.id, fileUrl)
    return fileUrl
  }

  useEffect(() => {
    const objectUrls = objectUrlsRef.current
    refreshFiles().catch(() => {})
    getConfig('pinHash').then((entry) => {
      if (entry?.value) {
        setPinHash(entry.value)
        setLocked(true)
      }
    }).catch(() => {})
    const updateMemory = () => {
      const used = performance.memory?.usedJSHeapSize
      if (used) setResourceMemory(used)
    }
    const firstMemoryFrame = window.requestAnimationFrame(updateMemory)
    const timer = window.setInterval(updateMemory, 2500)
    return () => {
      window.cancelAnimationFrame(firstMemoryFrame)
      window.clearInterval(timer)
      objectUrls.forEach(revokeFileUrl)
      objectUrls.clear()
    }
  }, [refreshFiles])

  useEffect(() => {
    if (!message) return undefined
    const timeout = window.setTimeout(() => setMessage(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [message])

  useEffect(() => {
    let frame
    if (!selectedFile || !viewerRef.current) {
      frame = window.requestAnimationFrame(() => setFindCount(0))
    } else {
      const count = highlightDocumentMatches(viewerRef.current, findQuery.trim(), findIndex)
      frame = window.requestAnimationFrame(() => setFindCount(count))
    }
    return () => window.cancelAnimationFrame(frame)
  }, [findQuery, findIndex, selectedFile, textContent, busy])

  useEffect(() => {
    if (findOpen) findInputRef.current?.focus()
  }, [findOpen, findMode])

  useEffect(() => {
    if (!selectedId) {
      setSelectedFile(null)
      setTextContent('')
      setPageCount(1)
      viewerRef.current?.replaceChildren()
      return
    }
    let cancelled = false
    let pageResizeObserver = null
    const load = async () => {
      try {
        let record = memoryFilesRef.current.get(selectedId)
        if (!record) {
          try {
            record = await getFile(selectedId)
          } catch {
            record = null
          }
        }
        if (!record || cancelled) return
        const fileUrl = await getFileUrl(record)
        if (!fileUrl) return
        const effectiveKind = record.type === 'image/png' ? 'PNG' : record.kind
        setBusy(true)
        setEditing(false)
        setPageCount(1)
        setSelectedFile({ ...record, fileUrl, kind: effectiveKind })
        setResourceMemory((current) => Math.max(current, record.size))
        const kind = effectiveKind
        if (kind === 'Word' && record.name.toLowerCase().endsWith('.docx')) {
          const response = await fetch(fileUrl)
          if (!response.ok) throw new Error('Unable to access the selected DOCX file')
          const buffer = await response.arrayBuffer()
          const docxViewer = await import('docx-preview')
          if (viewerRef.current) {
            viewerRef.current.replaceChildren()
            await docxViewer.renderAsync(buffer.slice(0), viewerRef.current, undefined, {
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              breakPages: true,
              ignoreLastRenderedPageBreak: false,
              renderHeaders: true,
              renderFooters: true,
              renderFootnotes: true,
            })
            if (!cancelled) {
              const pagination = paginateDocxPages(viewerRef.current)
              pageResizeObserver = pagination.observer
              setPageCount(pagination.count)
            }
          }
        } else if (kind === 'PDF') {
          const pdfjs = await import('pdfjs-dist')
          pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker
          const pdfSource = fileUrl.startsWith('data:')
            ? { data: await (await fetch(fileUrl)).arrayBuffer() }
            : { url: fileUrl }
          const pdf = await pdfjs.getDocument(pdfSource).promise
          if (cancelled || !viewerRef.current) return
          viewerRef.current.replaceChildren()
          setPageCount(pdf.numPages)
          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber)
            if (cancelled) return
            const viewport = page.getViewport({ scale: 1.15 })
            const canvas = document.createElement('canvas')
            canvas.className = 'pdf-canvas'
            canvas.width = viewport.width
            canvas.height = viewport.height
            await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
            const sheet = document.createElement('section')
            sheet.className = 'pdf-sheet paper-page'
            sheet.dataset.page = String(pageNumber)
            sheet.append(canvas)
            viewerRef.current.append(sheet)
          }
        } else if (kind === 'Excel') {
          if (!record.name.toLowerCase().endsWith('.xlsx')) {
            setMessage('Հին .xls ֆայլերը չեն աջակցվում։ Պահպանեք որպես .xlsx և կրկին բացեք։')
            return
          }
          const response = await fetch(fileUrl)
          if (!response.ok) throw new Error('Unable to access the selected spreadsheet')
          const buffer = await response.arrayBuffer()
          const { default: ExcelJS } = await import('exceljs')
          const workbook = new ExcelJS.Workbook()
          await workbook.xlsx.load(buffer.slice(0))
          const sheet = workbook.worksheets[0]
          const rows = []
          sheet.eachRow({ includeEmpty: true }, (row) => {
            rows.push(`<tr>${row.values.slice(1).map((value) => `<td>${escapeHtml(String(value ?? ''))}</td>`).join('')}</tr>`)
          })
          viewerRef.current.innerHTML = `<section class="spreadsheet-page paper-page"><table id="sheet-table"><tbody>${rows.join('')}</tbody></table></section>`
          setPageCount(1)
        } else if (kind === 'Word') {
          setMessage('Հին .doc ֆայլերը չեն աջակցվում։ Պահպանեք որպես .docx և կրկին բացեք։')
        } else if (kind === 'PNG') {
          const image = document.createElement('img')
          image.className = 'generated-image'
          image.alt = record.name
          image.src = fileUrl
          const page = document.createElement('section')
          page.className = 'paper-page image-page'
          page.append(image)
          viewerRef.current.replaceChildren(page)
          setPageCount(1)
        } else {
          const response = await fetch(fileUrl)
          if (!response.ok) throw new Error('Unable to access the selected text file')
          const text = await response.text()
          setTextContent(text)
          const chunks = paginateText(text)
          setPageCount(chunks.length)
        }
      } catch (error) {
        console.error(error)
        setMessage('Այս ֆայլը չհաջողվեց ցուցադրել։ DOCX, PDF, XLSX, XLS, CSV և TXT ձևաչափերն աջակցվում են։')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    load()
    return () => {
      cancelled = true
      pageResizeObserver?.disconnect()
    }
  }, [selectedId])

  useEffect(() => {
    if (selectedFile?.kind === 'Փաստաթուղթ' && viewerRef.current) {
      viewerRef.current.innerHTML = paginateText(textContent).map((text, index) => (
        `<section class="text-page paper-page" data-page="${index + 1}"><article>${escapeHtml(text).replace(/\n/g, '<br>')}</article><footer>${index + 1}</footer></section>`
      )).join('')
    }
  }, [textContent, selectedFile])

  useEffect(() => {
    if (!previewOpen || !previewRef.current || !viewerRef.current) return
    const clones = [...viewerRef.current.children].map((node) => {
      const clone = node.cloneNode(true)
      const sourceCanvases = [node, ...node.querySelectorAll('canvas')].filter((element) => element instanceof HTMLCanvasElement)
      const clonedCanvases = [clone, ...clone.querySelectorAll('canvas')].filter((element) => element instanceof HTMLCanvasElement)
      sourceCanvases.forEach((canvas, index) => {
        const copy = clonedCanvases[index]
        if (!copy) return
        copy.width = canvas.width
        copy.height = canvas.height
        copy.getContext('2d')?.drawImage(canvas, 0, 0)
      })
      return clone
    })
    let pageNumber = 0
    clones.forEach((clone) => {
      clone.querySelectorAll('.docx-page-frame, .paper-page').forEach((page) => {
        page.dataset.previewPage = String(++pageNumber)
      })
    })
    previewRef.current.replaceChildren(...clones)
  }, [previewOpen, pageCount, selectedId, busy])

  useEffect(() => {
    if (!previewOpen || !previewRef.current) return
    const preview = previewRef.current
    const size = PAPER_SIZES[paperSize]
    const updatePreviewPages = () => {
      const availableWidth = Math.max(280, preview.parentElement?.clientWidth - 40 || 520)
      const width = Math.min(520, availableWidth)
      const height = width * size.height / size.width
      const scale = width / (size.width * 96 / 25.4)
      preview.querySelectorAll('[data-preview-page]').forEach((page) => {
        const isSelected = Number(page.dataset.previewPage) === previewPage
        page.hidden = !isSelected
        if (page.classList.contains('docx-page-frame')) {
          const docxPage = page.querySelector(':scope > section.docx')
          page.style.width = `${width}px`
          page.style.height = `${height}px`
          page.style.position = 'relative'
          if (docxPage) {
            docxPage.style.setProperty('position', 'absolute', 'important')
            docxPage.style.setProperty('top', '0', 'important')
            docxPage.style.setProperty('left', '0', 'important')
            docxPage.style.setProperty('width', `${size.width}mm`, 'important')
            docxPage.style.setProperty('height', `${size.height}mm`, 'important')
            docxPage.style.setProperty('min-height', `${size.height}mm`, 'important')
            docxPage.style.setProperty('transform', `scale(${scale})`, 'important')
          }
        } else {
          page.style.setProperty('width', `${width}px`, 'important')
          page.style.setProperty('height', `${height}px`, 'important')
          page.style.aspectRatio = `${size.width} / ${size.height}`
        }
      })
    }
    updatePreviewPages()
    const observer = new ResizeObserver(updatePreviewPages)
    if (preview.parentElement) observer.observe(preview.parentElement)
    return () => observer.disconnect()
  }, [previewOpen, previewPage, paperSize, pageCount, selectedId, busy])

  const searchedFiles = files.filter((file) => file.name.toLowerCase().includes(search.toLowerCase()))

  const handleUpload = async (event) => {
    const input = event.currentTarget
    const incoming = [...(input.files || [])]
    if (!incoming.length) return
    setBusy(true)
    setMessage('')
    try {
      const newRecords = []
      for (const file of incoming) {
        const fileUrl = await createSafeFileUrl(file)
        if (!fileUrl) continue
        const record = {
          id: crypto.randomUUID(),
          name: file.name,
          kind: classifyFile(file),
          size: file.size,
          type: file.type,
          addedAt: Date.now(),
          blob: file,
          fileUrl,
        }
        objectUrlsRef.current.set(record.id, fileUrl)
        saveFileRecord(record)
        newRecords.push(record)
        setResourceMemory((current) => Math.max(current, file.size))
        setSelectedId(record.id)
      }
      setFiles((current) => [...newRecords, ...current.filter((record) => !newRecords.some((next) => next.id === record.id))])
      setActiveView('documents')
      setFileDrawerOpen(false)
      setMessage(`${incoming.length} ֆայլ բացվեց։`)
    } catch (error) {
      console.error(error)
      setMessage('Ֆայլի հղումը չհաջողվեց ստեղծել։ Ընտրեք ֆայլը կրկին։')
    } finally {
      setBusy(false)
      input.value = ''
    }
  }

  const beginRename = (file) => {
    const extensionIndex = file.name.lastIndexOf('.')
    setRenamingId(file.id)
    setRenameValue(extensionIndex > 0 ? file.name.slice(0, extensionIndex) : file.name)
  }

  const saveRename = (file) => {
    const baseName = renameValue.trim()
    if (!baseName) {
      setMessage('Ֆայլի անունը չի կարող դատարկ լինել։')
      return
    }
    const extensionIndex = file.name.lastIndexOf('.')
    const extension = extensionIndex > 0 ? file.name.slice(extensionIndex) : ''
    const renamedFile = { ...file, name: `${baseName}${extension}` }
    saveFileRecord(renamedFile)
    setFiles((current) => current.map((item) => item.id === file.id ? renamedFile : item))
    setSelectedFile((current) => current?.id === file.id ? { ...current, name: renamedFile.name } : current)
    setRenamingId(null)
    setMessage('Ֆայլի անունը փոխվեց։')
  }

  const removeFile = async (id) => {
    const file = files.find((item) => item.id === id)
    if (!window.confirm(`Ուզում ես ջնջել թե ոչ\n${file?.name || ''}`)) return
    memoryFilesRef.current.delete(id)
    const fileUrl = objectUrlsRef.current.get(id)
    revokeFileUrl(fileUrl)
    objectUrlsRef.current.delete(id)
    setFiles((current) => current.filter((file) => file.id !== id))
    void deleteFile(id).catch(() => {})
    if (selectedId === id) setSelectedId(null)
    setMessage('Ֆայլը հեռացվեց այս աշխատաշրջանից։')
  }

  const saveEditedCopy = useCallback(async () => {
    if (!selectedFile) return
    if (selectedFile.kind === 'Փաստաթուղթ') {
      const content = viewerRef.current?.innerText ?? textContent
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      downloadBlob(blob, selectedFile.name.replace(/\.[^.]+$/, '-խմբագրված.txt'))
      setMessage('Խմբագրված տեքստը ներբեռնվեց որպես նոր TXT ֆայլ։')
    } else if (selectedFile.kind === 'Excel') {
      const { default: ExcelJS } = await import('exceljs')
      const table = viewerRef.current?.querySelector('table')
      if (!table) return
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Sheet1')
      for (const row of table.rows) sheet.addRow([...row.cells].map((cell) => cell.innerText))
      const bytes = await workbook.xlsx.writeBuffer()
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      downloadBlob(blob, selectedFile.name.replace(/\.[^.]+$/, '-խմբագրված.xlsx'))
      setMessage('Խմբագրված աղյուսակը ներբեռնվեց որպես նոր XLSX ֆայլ։')
    } else if (selectedFile.kind === 'Word') {
      const { Document, Packer, Paragraph, TextRun } = await import('docx')
      const body = viewerRef.current?.innerText || ''
      const paragraphs = body.split('\n').filter(Boolean).map((line) => new Paragraph({ children: [new TextRun(line)] }))
      const doc = new Document({ sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph('')] }] })
      const blob = await Packer.toBlob(doc)
      downloadBlob(blob, selectedFile.name.replace(/\.[^.]+$/, '-խմբագրված.docx'))
      setMessage('Խմբագրված բովանդակությունը ներբեռնվեց նոր DOCX ֆայլով։ Տեսքը վերակազմավորվում է՝ հնարավոր է ձևաչափման կորուստ։')
    } else {
      setMessage('PDF ֆայլերը դիտման և տպման ռեժիմում են։')
      return
    }
    setEditing(false)
  }, [selectedFile, textContent])

  const createDocument = async (event) => {
    event.preventDefault()
    const baseName = newDocTitle.trim().replace(/\.[^.]+$/, '')
    if (!baseName || !newDocFormat) return
    setBusy(true)
    try {
      const generated = []
      if (newDocFormat === 'docx') {
        const { Document, Packer, Paragraph } = await import('docx')
        const doc = new Document({ sections: [{ children: newDocText.split('\n').map((line) => new Paragraph(line)) }] })
        generated.push({ name: `${baseName}.docx`, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', blob: await Packer.toBlob(doc) })
      }
      if (newDocFormat === 'pdf' || newDocFormat === 'png') {
        const pages = renderTextPages(newDocText)
        if (newDocFormat === 'png') {
          for (let index = 0; index < pages.length; index += 1) {
            const blob = await canvasToBlob(pages[index])
            generated.push({ name: `${baseName}${pages.length > 1 ? `-page-${index + 1}` : ''}.png`, type: 'image/png', blob })
          }
        }
        if (newDocFormat === 'pdf') {
          const { PDFDocument } = await import('pdf-lib')
          const pdf = await PDFDocument.create()
          for (const canvas of pages) {
            const pngBlob = await canvasToBlob(canvas)
            const png = await pdf.embedPng(await pngBlob.arrayBuffer())
            const page = pdf.addPage([595.28, 841.89])
            page.drawImage(png, { x: 0, y: 0, width: 595.28, height: 841.89 })
          }
          generated.push({ name: `${baseName}.pdf`, type: 'application/pdf', blob: new Blob([await pdf.save()], { type: 'application/pdf' }) })
        }
      }
      const records = []
      for (const item of generated) {
        const id = crypto.randomUUID()
        const fileUrl = await createSafeFileUrl(item.blob)
        if (!fileUrl) throw new Error(`Unable to create a local URL for ${item.name}`)
        const record = { id, name: item.name, kind: classifyFile({ name: item.name }), size: item.blob.size, type: item.type, addedAt: Date.now(), blob: item.blob, fileUrl }
        objectUrlsRef.current.set(id, fileUrl)
        saveFileRecord(record)
        records.push(record)
      }
      setFiles((current) => [...records, ...current])
      setSelectedId(records[0].id)
      setActiveView('documents')
      setCreateModalOpen(false)
      setNewDocTitle('')
      setNewDocText('')
      setMessage(`${records.length} ֆայլ ստեղծվեց։`)
    } catch (error) {
      console.error(error)
      setMessage('Չհաջողվեց ստեղծել ընտրված ձևաչափերը։ Փորձեք ավելի կարճ փաստաթղթով։')
    } finally {
      setBusy(false)
    }
  }

  const createPin = async (event) => {
    event.preventDefault()
    if (!/^\d{4,8}$/.test(pinSetup)) {
      setMessage('PIN-ը պետք է կազմված լինի 4-8 թվից։')
      return
    }
    const digest = await hashPin(pinSetup)
    await setConfig('pinHash', digest)
    setPinHash(digest)
    setPinSetup('')
    setMessage('Տեղային PIN-ը սահմանվեց։')
  }

  const unlock = async (event) => {
    event.preventDefault()
    if (await hashPin(pinInput) === pinHash) {
      setLocked(false)
      setPinInput('')
    } else setMessage('PIN կոդը սխալ է։')
  }

  const removePin = async () => {
    await removeConfig('pinHash')
    setPinHash('')
    setMessage('PIN կողպումը անջատված է։')
  }

  const toggleEditing = () => {
    if (!selectedFile) return
    if (selectedFile.kind === 'PDF' || selectedFile.type === 'image/png') {
      setMessage('Այս ձևաչափը բացված է միայն դիտման ռեժիմով։')
      return
    }
    setEditing((current) => !current)
    if (viewerRef.current) viewerRef.current.contentEditable = String(!editing)
  }

  const openPrintPreview = useCallback(() => {
    if (!selectedFile) {
      setMessage('Նախ ընտրեք կամ բացեք փաստաթուղթը։')
      return
    }
    setPreviewPage(1)
    setPreviewOpen(true)
  }, [selectedFile])

  const closeSelectedFile = () => {
    setSelectedId(null)
    setFileDrawerOpen(false)
    setEditing(false)
    setPreviewOpen(false)
  }

  const printDocument = () => {
    const selectedPages = parsePageRange(pageRange, pageCount)
    const copyCount = Number(copies)
    if (!selectedPages?.length) {
      setMessage(`Նշեք էջերի ճիշտ միջակայք՝ 1-ից ${pageCount}։`)
      return
    }
    if (!Number.isInteger(copyCount) || copyCount < 1 || copyCount > 99) {
      setMessage('Օրինակների քանակը պետք է լինի 1-ից 99։')
      return
    }

    const pageNodes = [...(previewRef.current?.querySelectorAll('[data-preview-page]') || [])]
    if (!pageNodes.length) {
      setMessage('Նախադիտման էջերը դեռ պատրաստ չեն։')
      return
    }
    const printRoot = document.createElement('main')
    printRoot.className = 'print-root'
    const size = PAPER_SIZES[paperSize]
    printRoot.style.setProperty('--print-width', `${size.width}mm`)
    printRoot.style.setProperty('--print-height', `${size.height}mm`)
    for (let copy = 0; copy < copyCount; copy += 1) {
      for (const pageNumber of selectedPages) {
        const source = pageNodes.find((page) => Number(page.dataset.previewPage) === pageNumber)
        if (source) {
          const pageCopy = source.cloneNode(true)
          pageCopy.hidden = false
          pageCopy.removeAttribute('hidden')
          printRoot.append(pageCopy)
        }
      }
    }
    const printStyle = document.createElement('style')
    printStyle.textContent = `@page { size: ${size.width}mm ${size.height}mm; margin: 0; }`
    document.head.append(printStyle)
    document.body.append(printRoot)
    try {
      window.print()
    } finally {
      printRoot.remove()
      printStyle.remove()
    }
  }

  const changePreviewPage = (direction) => {
    setPreviewPage((current) => Math.min(pageCount, Math.max(1, current + direction)))
  }
  const openCreateModal = () => {
    setNewDocTitle('')
    setNewDocText('')
    setNewDocFormat('docx')
    setCreateModalOpen(true)
  }

  const openFindPanel = useCallback((mode = 'find') => {
    setFindMode(mode)
    setFindOpen(true)
  }, [])

  const moveFindResult = (direction) => {
    if (!findCount) return
    setFindIndex((current) => (current + direction + findCount) % findCount)
  }

  const replaceAllMatches = () => {
    if (!viewerRef.current || !findQuery.trim()) return
    clearDocumentHighlights(viewerRef.current)
    const matcher = new RegExp(findQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
    const walker = document.createTreeWalker(viewerRef.current, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    let replaced = 0
    for (const node of nodes) {
      const value = node.nodeValue || ''
      const matches = value.match(matcher)
      if (!matches) continue
      replaced += matches.length
      node.nodeValue = value.replace(matcher, replaceQuery)
    }
    setFindIndex(0)
    setFindQuery(replaceQuery)
    setMessage(`${replaced} համընկնում փոխարինվեց։`)
  }

  const navigateToPage = () => {
    const pageNumber = Number.parseInt(goToPage, 10)
    const pages = viewerRef.current?.querySelectorAll('.paper-page, .docx-page-frame > section.docx')
    if (!pages?.length || !Number.isFinite(pageNumber) || pageNumber < 1 || pageNumber > pages.length) {
      setMessage(`Մուտքագրեք 1-ից ${pages?.length || pageCount} էջի համար։`)
      return
    }
    pages[pageNumber - 1].scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      const target = event.target
      const isField = target instanceof HTMLElement && target.matches('input, textarea, select')

      if (key === 'f' || key === 'h' || key === 'g') {
        event.preventDefault()
        openFindPanel(key === 'h' ? 'replace' : key === 'g' ? 'goto' : 'find')
        return
      }
      if (key === 'n') {
        event.preventDefault()
        openCreateModal()
      } else if (key === 'o') {
        event.preventDefault()
        fileInputRef.current?.click()
      } else if (key === 's') {
        event.preventDefault()
        if (selectedFile) void saveEditedCopy()
        else if (createModalOpen) document.querySelector('.create-modal')?.requestSubmit()
      } else if (key === 'p') {
        event.preventDefault()
        openPrintPreview()
      } else if (!isField && ['b', 'i', 'u', 'l', 'e', 'r', 'j', 'd', 'w'].includes(key)) {
        const selection = window.getSelection()
        const selectionInViewer = selection?.anchorNode && viewerRef.current?.contains(selection.anchorNode)
        if (!editing || !selectionInViewer) return
        event.preventDefault()
        if (key === 'b' && !event.shiftKey) document.execCommand('bold')
        if (key === 'i' && !event.shiftKey) document.execCommand('italic')
        if (key === 'u' && !event.shiftKey) document.execCommand('underline')
        if (key === 'l' && !event.shiftKey) document.execCommand('justifyLeft')
        if (key === 'e' && !event.shiftKey) document.execCommand('justifyCenter')
        if (key === 'r' && !event.shiftKey) document.execCommand('justifyRight')
        if (key === 'j' && !event.shiftKey) document.execCommand('justifyFull')
        if (key === 'd' && event.shiftKey) decorateSelection('double')
        if (key === 'w' && event.shiftKey) decorateSelection('solid', true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editing, selectedFile, createModalOpen, findCount, openFindPanel, saveEditedCopy, openPrintPreview])

  return (
    <div className="app-shell">
      {locked && (
        <div className="lock-screen">
          <form className="lock-panel" onSubmit={unlock}>
            <span className="lock-icon"><LockKeyhole size={22} /></span>
            <p className="eyebrow">OFFLINE STUDIO / PRIVATE</p>
            <h1>Մուտքագրեք PIN-ը</h1>
            <p className="muted">Այս դիտարկչի տեղային միջավայրն արգելափակված է։</p>
            <input autoFocus inputMode="numeric" type="password" maxLength={8} value={pinInput} onChange={(event) => setPinInput(event.target.value)} aria-label="PIN կոդ" />
            <button className="button button-primary" type="submit">Բացել ստուդիան <ArrowRight size={16} /></button>
          </form>
        </div>
      )}

      <style>{`
        .file-row { cursor: default; }
        .file-open { display: flex; flex: 1; min-width: 0; align-items: center; gap: 9px; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
        .file-open .file-info { min-width: 0; }
        .file-open .file-info > b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .file-actions { position: relative; display: flex; flex: 0 0 auto; align-items: center; }
        .file-action { width: 27px; height: 27px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 4px; background: transparent; cursor: pointer; }
        .file-action:hover { background: rgba(148, 163, 184, .12); color: #f1f5f9; }
        .file-menu { position: absolute; top: calc(100% + 4px); right: 0; z-index: 30; width: 150px; padding: 4px; border: 1px solid rgba(148, 163, 184, .2); border-radius: 5px; background: #111b2d; box-shadow: 0 10px 28px rgba(0, 0, 0, .4); }
        .file-menu-item { width: 100%; min-height: 31px; padding: 0 9px; border: 0; border-radius: 3px; background: transparent; color: #d7e0ec; text-align: left; font-size: 11px; cursor: pointer; }
        .file-menu-item:hover, .file-menu-item:focus-visible { background: rgba(148, 163, 184, .12); color: #fff; }
        .file-menu-item.file-menu-delete { color: #fca5a5; }
        .file-menu-item.file-menu-delete:hover, .file-menu-item.file-menu-delete:focus-visible { background: rgba(248, 113, 113, .12); }
        .file-name-edit { display: flex; min-width: 0; align-items: center; gap: 2px; color: #8493a9; }
        .file-name-edit input { width: 100%; min-width: 0; height: 23px; padding: 0 4px; border: 1px solid rgba(156, 123, 255, .45); border-radius: 3px; outline: 0; background: #0b1220; color: #e2e8f0; font: inherit; }
        .file-name-edit > span { flex: 0 0 auto; }
        .docx-page-frame { position: relative; flex: 0 0 auto; overflow: visible; }
        .docx-page-frame > section.docx { position: absolute !important; top: 0 !important; left: 0 !important; transform-origin: top left !important; margin: 0 !important; }
        .docx-page-frame > section.docx > .studio-page-number { z-index: 5 !important; }
        .preview-pages .docx-page-frame { overflow: visible; }
        @media print {
          .document-pages .docx-page-frame { width: 210mm !important; height: 297mm !important; margin: 0 !important; break-after: page !important; page-break-after: always !important; }
          .document-pages .docx-page-frame:last-child { break-after: auto !important; page-break-after: auto !important; }
          .document-pages .docx-page-frame > section.docx { position: relative !important; width: 210mm !important; height: 297mm !important; transform: none !important; }
        }
      `}</style>

      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span className="brand-name">OFFLINE <b>STUDIO</b><small>DOCUMENT WORKSPACE</small></span>
          <button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Փակել ընտրացանկը"><X size={18} /></button>
        </div>
        <div className="side-label">ԱՇԽԱՏԱՏԱՐԱԾՔ</div>
        <nav className="section-nav" aria-label="Հիմնական ընտրացանկ">
          <button className={activeView === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('home'); setFileDrawerOpen(false); setMenuOpen(false) }}><Activity size={17} /> Գլխավոր վահանակ</button>
          <button className={activeView === 'documents' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('documents'); setFileDrawerOpen(false); setMenuOpen(false) }}><FileText size={17} /> Փաստաթղթեր <span className="nav-count">{files.length}</span></button>
          <button className="nav-item" onClick={() => { openCreateModal(); setFileDrawerOpen(false); setMenuOpen(false) }}><Pencil size={17} /> Նոր փաստաթուղթ</button>
          <button className={activeView === 'security' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('security'); setFileDrawerOpen(false); setMenuOpen(false) }}><ShieldCheck size={17} /> Անվտանգություն</button>
        </nav>
        <div className="side-storage">
          <div className="storage-head"><span><Database size={15} /> Տեղային պահոց</span><span className="online-dot" /></div>
          <strong>{files.length} <small>ֆայլ</small></strong>
          <p>Պահվում է միայն այս սարքում՝ IndexedDB-ում։</p>
        </div>
        <div className="side-bottom"><span className="status-dot" /> Օֆլայն ռեժիմ <span className="version">v10.0</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-leading">
            <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Բացել գլխավոր ընտրացանկը" title="Գլխավոր ընտրացանկ"><Menu size={19} /></button>
            <span className="topbar-path">STUDIO <span>/</span> {activeView === 'home' ? 'ՎԱՀԱՆԱԿ' : activeView === 'documents' ? 'ՓԱՍՏԱԹՂԹԵՐ' : activeView === 'editor' ? 'ԽՄԲԱԳՐԻՉ' : 'ԱՆՎՏԱՆԳՈՒԹՅՈՒՆ'}</span>
          </div>
          <div className="topbar-actions">
            {activeView === 'documents' && selectedFile && (
              <>
                <button className={`button button-quiet ${editing ? 'is-editing' : ''}`} onClick={toggleEditing} title="Խմբագրել"><Pencil size={15} /><span>{editing ? 'Խմբագրում' : 'Խմբագրել'}</span></button>
                {editing && <button className="button button-primary compact-button" onClick={saveEditedCopy}><Check size={15} /><span>Պահել պատճենը</span></button>}
                <button className="button button-primary compact-button" onClick={openPrintPreview}><Printer size={15} /><span>Տպել / PDF</span></button>
                <button className="button button-quiet" onClick={closeSelectedFile} title="Փակել փաստաթուղթը" aria-label="Փակել փաստաթուղթը"><X size={15} /></button>
              </>
            )}
            <button className="button button-quiet" onClick={() => fileInputRef.current?.click()}><Upload size={15} /><span>Բացել ֆայլ</span></button>
            <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.rtf,.png" onChange={handleUpload} />
          </div>
        </header>

        {message && <div className="notice" role="status"><span>{message}</span><button className="icon-button" onClick={() => setMessage('')} aria-label="Փակել հաղորդագրությունը"><X size={15} /></button></div>}

        {activeView === 'home' && (
          <div className="page-content home-page">
            <section className="welcome-row">
              <div><p className="eyebrow">PRIVATE DOCUMENT WORKSPACE <span className="eyebrow-mark">/ 10.0</span></p><h1>Փաստաթղթերը՝ <span>ձեր վերահսկողության տակ։</span></h1><p className="welcome-copy">Դիտեք, խմբագրեք և տպեք ձեր փաստաթղթերը՝ տեղային, առանց ամպային փոխանցման։</p></div>
              <button className="button button-primary start-button" onClick={() => setActiveView('documents')}><BookOpen size={16} /> Բացել աշխատատարածքը <ArrowRight size={15} /></button>
            </section>

            <section className="resource-strip" aria-label="Ռեսուրսների մոնիտոր">
              <div className="resource-heading"><div className="resource-orbit"><Activity size={18} /></div><div><strong>Ռեսուրսների հսկում</strong><small>Տեղային միջավայրի ընթացիկ վիճակ</small></div></div>
              <div className="resource-metric"><div className="metric-title"><Cpu size={15} /> CPU <span className="metric-unknown">Բրաուզերը չի հայտնում</span></div><div className="meter"><i className={busy ? 'meter-busy' : ''} /></div><small>{busy ? 'Փաստաթուղթը մշակվում է' : 'Ազատ / սպասման ռեժիմ'}</small></div>
              <div className="resource-metric"><div className="metric-title"><HardDrive size={15} /> RAM heap <span className="metric-value">{formatBytes(resourceMemory)}</span></div><div className="meter meter-blue"><i style={{ width: `${Math.min(92, Math.max(8, resourceMemory / (64 * 1024 * 1024) * 100))}%` }} /></div><small>{performance.memory ? 'Բրաուզերի տրամադրած heap չափում' : 'Ներբեռնված փաստաթղթի չափի մոտավոր ցուցիչ'}</small></div>
              <div className="resource-state"><span className="online-dot" /><span>Ամպային կապ չկա</span></div>
            </section>

            <section className="home-grid">
              <div className="recent-panel">
                <div className="panel-heading"><div><p className="eyebrow">ՏԵՂԱՅԻՆ ԱՐԽԻՎ</p><h2>Վերջին փաստաթղթերը</h2></div><button className="text-button" onClick={() => setActiveView('documents')}>Բոլորը <ArrowRight size={14} /></button></div>
                {files.length ? <div className="recent-list">{files.slice(0, 4).map((file) => <button className="recent-file" key={file.id} onClick={() => { setSelectedId(file.id); setActiveView('documents') }}><FileType kind={file.kind} /><span className="file-info"><b>{file.name}</b><small>{file.kind} · {formatBytes(file.size)}</small></span><ArrowRight size={15} /></button>)}</div> : <div className="empty-recent"><span className="empty-icon"><FileText size={20} /></span><div><b>Արխիվը դեռ դատարկ է</b><p>Ավելացրեք DOCX, PDF կամ Excel փաստաթուղթ՝ սկսելու համար։</p></div><button className="button button-outline" onClick={() => fileInputRef.current?.click()}><Plus size={15} /> Ավելացնել</button></div>}
              </div>
              <aside className="security-panel"><span className="security-icon"><ShieldCheck size={20} /></span><p className="eyebrow">ՏԵՂԱՅԻՆ ԱՆՎՏԱՆԳՈՒԹՅՈՒՆ</p><h2>Ձեր ֆայլերը մնում են այստեղ։</h2><p>Փաստաթղթերը պահվում են սարքի IndexedDB-ում։ Ոչ մի cloud, ոչ մի հաշիվ, ոչ մի վերբեռնում։</p><div className="security-check"><Check size={14} /> Բրաուզերի տեղային տվյալներ</div><div className="security-check"><Check size={14} /> Կարգավորվող PIN կողպում</div><button className="text-button" onClick={() => setActiveView('security')}>Կարգավորել պաշտպանությունը <ArrowRight size={14} /></button></aside>
            </section>

            <section className="feature-section"><div className="section-heading"><p className="eyebrow">ԳՈՐԾԻՔՆԵՐ</p><h2>Մեկ միջավայր՝ փաստաթղթի ամբողջ ճանապարհի համար։</h2></div><div className="feature-grid"><Feature icon={<FileText size={19} />} number="01" title="Word փաստաթղթեր" text="DOCX էջերի առանձին նախադիտում, տեքստային խմբագրում և նոր DOCX պատճեն պահելու հնարավորություն։" /><Feature icon={<FileSpreadsheet size={19} />} number="02" title="PDF և Excel" text="PDF էջ առ էջ դիտում ու տպում, Excel աղյուսակների դիտում և խմբագրվող XLSX պատճենի ներբեռնում։" /><Feature icon={<Printer size={19} />} number="03" title="A4 տպագրություն" text="A4 թղթի չափ, կայուն լուսանցքներ, կենտրոնացված էջահամարներ և բրաուզերի native print։" /></div></section>

            <section className="guide-band"><div><p className="eyebrow">ՏՊԱԳՐԱԿԱՆ ՈՒՂԵՑՈՒՅՑ</p><h2>A4 պատրաստ՝ առանց անակնկալների։</h2><p>Նախադիտումը ցույց է տալիս էջերի հաշվարկված քանակը։ Տպելուց առաջ ընտրեք A4 թուղթ և ստուգեք բրաուզերի լուսանցքները։</p></div><div className="a4-spec"><span>A4</span><small>210 × 297 mm</small><i /></div><div className="guide-points"><span><Check size={14} /> 20 mm ներքին լուսանցք</span><span><Check size={14} /> Մաքուր սպիտակ թուղթ</span><span><Check size={14} /> Կենտրոնացված footer</span></div></section>
            <footer className="page-footer"><span>OFFLINE STUDIO <b>v10.0</b></span><span>Տեղային փաստաթղթային միջավայր</span><span><span className="online-dot" /> Մասնավոր ռեժիմ</span></footer>
          </div>
        )}

        {activeView === 'documents' && (
          <div className="document-workspace">
            {fileDrawerOpen && <button type="button" className="file-drawer-backdrop" aria-label="Փակել ֆայլերի ցանկը" onClick={() => setFileDrawerOpen(false)} />}
            <aside className={`file-rail ${fileDrawerOpen ? 'file-rail-open' : ''}`} aria-hidden={!fileDrawerOpen}>
              <div className="rail-heading"><div><p className="eyebrow">ՏԵՂԱՅԻՆ ՊԱՀՈՑ</p><h2>Փաստաթղթեր <span>{files.length}</span></h2></div><div className="rail-heading-actions"><button className="icon-button accent-icon" onClick={() => fileInputRef.current?.click()} title="Ավելացնել ֆայլ" aria-label="Ավելացնել ֆայլ"><Plus size={18} /></button><button className="icon-button file-drawer-close" onClick={() => setFileDrawerOpen(false)} title="Փակել ֆայլերի ցանկը" aria-label="Փակել ֆայլերի ցանկը"><X size={18} /></button></div></div>
              <label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Որոնել ֆայլերը" /></label>
              <div className="category-list" aria-label="Ֆայլերի բաժիններ">
                {FILE_CATEGORIES.map((category) => {
                  const categoryFiles = searchedFiles.filter((file) => category.kinds.includes(file.kind))
                  const isOpen = Boolean(openCategories[category.id])
                  const panelId = `file-category-${category.id}`
                  return (
                    <section className="file-category" key={category.id}>
                      <button className="category-toggle" type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenCategories((current) => ({ ...current, [category.id]: !current[category.id] }))}>
                        <span className="category-name"><ChevronDown size={14} className={isOpen ? 'category-chevron is-open' : 'category-chevron'} />{category.label}</span>
                        <span className="category-count">{files.filter((file) => category.kinds.includes(file.kind)).length}</span>
                      </button>
                      {isOpen && <div className="file-list category-files" id={panelId}>
                        {categoryFiles.map((file) => {
                          const extensionIndex = file.name.lastIndexOf('.')
                          const extension = extensionIndex > 0 ? file.name.slice(extensionIndex) : ''
                          const isRenaming = renamingId === file.id
                          return <div key={file.id} className={`file-row${selectedId === file.id ? ' file-selected' : ''}`}>
                            <button type="button" className="file-open" onClick={() => { setSelectedId(file.id); setFileDrawerOpen(false) }} aria-label={`Բացել ${file.name}`}>
                              <FileType kind={file.kind} />
                              <span className="file-info">
                                {isRenaming ? <span className="file-name-edit"><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveRename(file) } else if (event.key === 'Escape') setRenamingId(null) }} aria-label="Ֆայլի անունն առանց ընդլայնման" /><span>{extension}</span></span> : <b>{file.name}</b>}
                                <small>{formatBytes(file.size)} · {new Date(file.addedAt).toLocaleDateString('hy-AM')}</small>
                              </span>
                            </button>
                            <div className="file-actions" ref={fileMenuRef}>
                              {isRenaming ? (
                                <button type="button" className="file-action" title="Պահպանել անունը" aria-label="Պահպանել անունը" onClick={() => saveRename(file)}><Check size={14} /></button>
                              ) : (
                                <button type="button" className="file-action" title="Գործողություններ" aria-label={`${file.name} գործողություններ`} aria-haspopup="menu" aria-expanded={openFileMenuId === file.id} onClick={() => setOpenFileMenuId((current) => current === file.id ? null : file.id)}><EllipsisVertical size={16} /></button>
                              )}
                              {openFileMenuId === file.id && !isRenaming && <div className="file-menu" role="menu">
                                <button type="button" className="file-menu-item" role="menuitem" onClick={() => { setOpenFileMenuId(null); beginRename(file) }}>переименовать</button>
                                <button type="button" className="file-menu-item file-menu-delete" role="menuitem" onClick={() => { setOpenFileMenuId(null); void removeFile(file.id) }}>удалить</button>
                              </div>}
                            </div>
                          </div>
                        })}
                        {categoryFiles.length === 0 && <div className="category-empty">{search ? 'Համապատասխան ֆայլ չի գտնվել։' : 'Այս բաժինը դատարկ է։'}</div>}
                      </div>}
                    </section>
                  )
                })}
              </div>
              <button className="button button-outline rail-upload" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Ներմուծել ֆայլեր</button>
            </aside>
            <section className="viewer-area">
              <div className="viewer-toolbar"><div className="viewer-file-title"><button className="icon-button viewer-rail-toggle" type="button" onClick={() => setFileDrawerOpen(true)} aria-label="Բացել ֆայլերի և բաժինների վահանակը" title="Ֆայլերի բաժիններ"><EllipsisVertical size={19} /></button></div><div className="viewer-meta">{selectedFile && <><span>{pageCount} էջ</span><span className="meta-divider" />A4<button type="button" className={`icon-button viewer-find-toggle${findOpen ? ' is-active' : ''}`} onClick={() => findOpen ? setFindOpen(false) : openFindPanel('find')} aria-label="Որոնել փաստաթղթում" title="Որոնել փաստաթղթում (Ctrl+F)"><Search size={16} /></button></>}</div></div>
              {findOpen && selectedFile && <div className="viewer-findbar" role="search">
                {findMode === 'goto' ? <>
                  <label htmlFor="document-goto">Անցնել էջ</label>
                  <input ref={findInputRef} id="document-goto" type="number" min="1" max={pageCount} value={goToPage} onChange={(event) => setGoToPage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && navigateToPage()} />
                  <button type="button" className="icon-button" onClick={navigateToPage} aria-label="Անցնել էջին"><ArrowRight size={15} /></button>
                </> : <>
                  <input ref={findInputRef} type="search" value={findQuery} onChange={(event) => { setFindQuery(event.target.value); setFindIndex(0) }} placeholder="Որոնել փաստաթղթում" aria-label="Որոնել փաստաթղթում" />
                  <span className="viewer-find-count">{findQuery ? `${findCount ? findIndex + 1 : 0} / ${findCount}` : ''}</span>
                  {findMode === 'replace' && <input type="text" value={replaceQuery} onChange={(event) => setReplaceQuery(event.target.value)} placeholder="Փոխարինել" aria-label="Փոխարինել տեքստը" />}
                  {findMode === 'replace' && <button type="button" className="viewer-find-command" onClick={replaceAllMatches}>Փոխարինել բոլորը</button>}
                  <button type="button" className="icon-button" onClick={() => moveFindResult(-1)} disabled={!findCount} aria-label="Նախորդ արդյունքը" title="Նախորդ արդյունքը"><ChevronUp size={16} /></button>
                  <button type="button" className="icon-button" onClick={() => moveFindResult(1)} disabled={!findCount} aria-label="Հաջորդ արդյունքը" title="Հաջորդ արդյունքը"><ChevronDown size={16} /></button>
                </>}
                <button type="button" className="icon-button" onClick={() => setFindOpen(false)} aria-label="Փակել որոնումը"><X size={15} /></button>
              </div>}
              <div className="paper-stage">
                {!selectedFile && <div className="viewer-empty"><span className="empty-icon"><FileText size={23} /></span><h2>Ընտրեք փաստաթուղթը</h2><p>Ձեր տեղային ֆայլերը հասանելի են միայն այս սարքում։</p><button className="button button-primary" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Բացել ֆայլ</button></div>}
                {busy && <div className="loading-indicator"><span className="spinner" /> Փաստաթուղթը մշակվում է…</div>}
                <div ref={viewerRef} className={`document-pages ${selectedFile ? '' : 'is-empty'} ${editing ? 'is-editing' : ''}`} />
              </div>
              {selectedFile && <div className="viewer-footer"><span>{editing ? 'Խմբագրումները պահվում են որպես նոր պատճեն։' : 'Էջերը ցուցադրվում են A4 չափին համապատասխանեցված։'}</span><span>{pageCount} էջ <i className="meta-divider" /> {formatBytes(selectedFile.size)}</span></div>}
            </section>
          </div>
        )}

        {activeView === 'security' && (
          <div className="page-content security-page"><div className="editor-heading"><p className="eyebrow">ԳԱՂՏՆԻՈՒԹՅՈՒՆ ԵՎ ՊԱՀՊԱՆՈՒՄ</p><h1>Անվտանգությունը՝ տեղային։</h1><p>Ֆայլերը մնում են բրաուզերի IndexedDB տվյալների բազայում։ Հավելվածը չի օգտագործում cloud կամ ֆայլային LocalStorage։</p></div><section className="security-settings"><div className="setting-row"><span className="setting-icon"><Database size={18} /></span><div><b>IndexedDB պահոց</b><p>{files.length} փաստաթուղթ · {formatBytes(files.reduce((sum, file) => sum + file.size, 0))}</p></div><span className="setting-status"><i className="online-dot" /> Ակտիվ</span></div><div className="setting-row"><span className="setting-icon"><LockKeyhole size={18} /></span><div><b>Տեղային PIN կողպում</b><p>PIN-ը պահվում է որպես SHA-256 digest։ Սա սարքի կողպման շերտ է, ոչ թե ֆայլերի կոդավորում։</p></div>{pinHash ? <button className="button button-outline danger-button" onClick={removePin}>Անջատել PIN-ը</button> : <span className="setting-status">Անջատված</span>}</div>{!pinHash && <form className="pin-form" onSubmit={createPin}><label>Նոր PIN <input type="password" inputMode="numeric" maxLength={8} minLength={4} pattern="[0-9]{4,8}" placeholder="4–8 թվանշան" value={pinSetup} onChange={(event) => setPinSetup(event.target.value)} required /></label><button className="button button-primary" type="submit"><ShieldCheck size={15} /> Սահմանել PIN</button></form>}</section><div className="security-note"><ShieldCheck size={18} /><p><b>Գաղտնիության սահմանը</b><br />PIN-ի մոռացման դեպքում տվյալները չեն վերականգնվում սերվերից։ Բրաուզերի site data-ի մաքրումը կարող է ջնջել այս պահոցը. կարևոր ֆայլերի համար պահեք ներբեռնված պատճեն։</p></div></div>
        )}
      </main>

      {createModalOpen && (
        <div className="create-overlay" role="dialog" aria-modal="true" aria-labelledby="create-title" onMouseDown={(event) => event.target === event.currentTarget && setCreateModalOpen(false)}>
          <form className="create-modal" onSubmit={createDocument}>
            <header className="create-modal-header"><div><p className="eyebrow">ՆՈՐ ՓԱՍՏԱԹՈՒՂԹ</p><h2 id="create-title">Ընտրեք ձևաչափը</h2></div><button type="button" className="icon-button" onClick={() => setCreateModalOpen(false)} aria-label="Փակել"><X size={18} /></button></header>
            <label className="create-field">Ֆայլի անուն<input autoFocus value={newDocTitle} onChange={(event) => setNewDocTitle(event.target.value)} placeholder="օրինակ՝ Հանդիպման նշումներ" required /></label>
            <label className="create-field">Բովանդակություն<textarea value={newDocText} onChange={(event) => setNewDocText(event.target.value)} placeholder="Սկսեք գրել ձեր փաստաթուղթը…" rows={8} /></label>
            <fieldset className="format-picker"><legend>Արտահանման ձևաչափեր</legend><div className="format-options">{[
              { id: 'docx', title: 'Word', suffix: '.docx', note: 'Խմբագրվող փաստաթուղթ' },
              { id: 'pdf', title: 'PDF', suffix: '.pdf', note: 'A4 էջերով պատրաստ տպման' },
              { id: 'png', title: 'PNG', suffix: '.png', note: 'Յուրաքանչյուր էջ՝ առանձին պատկեր' },
            ].map((format) => <label className="format-option" key={format.id}><input type="radio" name="document-format" value={format.id} checked={newDocFormat === format.id} onChange={() => setNewDocFormat(format.id)} /><span className="format-check"><Check size={13} /></span><span className="format-copy"><b>{format.title} <small>{format.suffix}</small></b><small>{format.note}</small></span></label>)}</div></fieldset>
            <footer className="create-modal-footer"><span>Ֆայլը կպահվի այս սարքի IndexedDB-ում։</span><div><button type="button" className="button button-quiet" onClick={() => setCreateModalOpen(false)}>Չեղարկել</button><button type="submit" className="button button-primary" disabled={busy || !newDocFormat}><Check size={15} /> {busy ? 'Ստեղծվում է…' : 'Ստեղծել ֆայլը'}</button></div></footer>
          </form>
        </div>
      )}

      {previewOpen && (
        <div className="preview-overlay" role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => event.target === event.currentTarget && setPreviewOpen(false)}>
          <section className="preview-modal">
            <header className="preview-header"><div><p className="eyebrow">ՏՊՄԱՆ ՆԱԽԱԴԻՏՈՒՄ</p><h2 id="preview-title">{selectedFile?.name}</h2><span className="preview-count">{pageCount} էջ <b>•</b> {PAPER_SIZES[paperSize].label}</span></div><button className="icon-button" onClick={() => setPreviewOpen(false)} aria-label="Փակել նախադիտումը"><X size={19} /></button></header>
            <div className="preview-layout">
              <main className="preview-paper-area">
                <div className="preview-scroll"><div ref={previewRef} className="preview-pages" /></div>
                <nav className="preview-pagination" aria-label="Էջերի նավարկում">
                  <button type="button" className="icon-button" onClick={() => changePreviewPage(-1)} disabled={previewPage <= 1} aria-label="Նախորդ էջ"><ChevronLeft size={17} /></button>
                  <span><b>{previewPage}</b> / {pageCount}</span>
                  <button type="button" className="icon-button" onClick={() => changePreviewPage(1)} disabled={previewPage >= pageCount} aria-label="Հաջորդ էջ"><ChevronRight size={17} /></button>
                </nav>
              </main>
              <aside className="print-settings" aria-label="Տպման կարգավորումներ">
                <h3>Տպման կարգավորումներ</h3>
                <label>Օրինակների քանակ
                  <input type="number" min="1" max="99" value={copies} onChange={(event) => setCopies(event.target.value)} />
                </label>
                <label>Էջեր
                  <input type="text" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="բոլորը կամ 1-5" aria-describedby="page-range-help" />
                  <small id="page-range-help">Օրինակ՝ բոլորը, 1-5 կամ 1,3,5</small>
                </label>
                <label>Թղթի չափ
                  <select value={paperSize} onChange={(event) => setPaperSize(event.target.value)}>
                    {Object.values(PAPER_SIZES).map((size) => <option key={size.label} value={size.label}>{size.label}</option>)}
                  </select>
                </label>
                <div className="print-settings-summary"><span>Տպվող էջեր</span><b>{parsePageRange(pageRange, pageCount)?.length ?? '—'}</b></div>
              </aside>
            </div>
            <footer className="preview-actions"><span>Տպման պատուհանում ընտրեք «Save as PDF»՝ PDF պահպանելու համար։</span><div><button className="button button-quiet" onClick={() => setPreviewOpen(false)}>Փակել</button><button className="button button-primary" onClick={printDocument}><Printer size={15} /> Տպել</button></div></footer>
          </section>
        </div>
      )}
    </div>
  )
}

function FileType({ kind }) {
  const Icon = kind === 'PDF' ? FileText : kind === 'Excel' ? FileSpreadsheet : FileText
  return <span className={`file-type type-${kind === 'Փաստաթուղթ' ? 'doc' : kind.toLowerCase()}`}><Icon size={16} /></span>
}

function Feature({ icon, number, title, text }) {
  return <article className="feature-item"><div className="feature-top"><span className="feature-icon">{icon}</span><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>
}

function paginateText(text) {
  const lines = text.split('\n')
  const pages = []
  let current = ''
  for (const line of lines) {
    if (current.length + line.length > 2600 && current) {
      pages.push(current)
      current = ''
    }
    current += `${line}\n`
  }
  pages.push(current)
  return pages
}

function paginateDocxPages(container) {
  const wrapper = container.querySelector('.docx-wrapper')
  if (!wrapper) return 1

  const sourcePages = [...wrapper.querySelectorAll(':scope > section.docx')]
  if (!sourcePages.length) return { count: 1, observer: null }
  sourcePages.forEach((page) => page.remove())
  const renderedPages = []

  for (const sourcePage of sourcePages) {
    const articles = [...sourcePage.children].filter((child) => child.tagName === 'ARTICLE')
    if (!articles.length) {
      wrapper.append(sourcePage)
      renderedPages.push(sourcePage)
      continue
    }

    for (const sourceArticle of articles) {
      const blocks = [...sourceArticle.children]
      let page
      let frame
      let article
      let blockCount = 0

      const createPage = () => {
        frame = document.createElement('div')
        frame.className = 'docx-page-frame'
        const nextPage = sourcePage.cloneNode(false)
        nextPage.replaceChildren()
        nextPage.style.setProperty('width', '210mm', 'important')
        nextPage.style.setProperty('min-width', '210mm', 'important')
        nextPage.style.setProperty('max-width', '210mm', 'important')
        nextPage.style.setProperty('height', '297mm', 'important')
        nextPage.style.setProperty('min-height', '297mm', 'important')
        nextPage.style.setProperty('aspect-ratio', 'auto', 'important')
        nextPage.style.setProperty('padding', '20mm', 'important')
        nextPage.style.setProperty('margin', '0 auto 24px', 'important')
        nextPage.style.setProperty('overflow', 'hidden', 'important')
        nextPage.style.setProperty('background', '#ffffff', 'important')
        nextPage.style.setProperty('color', '#111827', 'important')
        nextPage.style.setProperty('box-shadow', '0 4px 20px rgba(0, 0, 0, 0.5)', 'important')
        nextPage.style.setProperty('position', 'absolute', 'important')
        nextPage.style.setProperty('top', '0', 'important')
        nextPage.style.setProperty('left', '0', 'important')
        nextPage.style.setProperty('margin', '0', 'important')

        for (const child of sourcePage.children) {
          if (child === sourceArticle) {
            article = sourceArticle.cloneNode(false)
            nextPage.append(article)
          } else nextPage.append(child.cloneNode(true))
        }
        frame.append(nextPage)
        wrapper.append(frame)
        page = nextPage
        blockCount = 0
      }

      createPage()
      for (const block of blocks) {
        const copy = block.cloneNode(true)
        copy.querySelectorAll('*').forEach((element) => element.style.setProperty('color', '#111827', 'important'))
        copy.style.setProperty('color', '#111827', 'important')
        article.append(copy)
        blockCount += 1

        const pageStyle = getComputedStyle(page)
        const reserved = Number.parseFloat(pageStyle.paddingTop)
          + Number.parseFloat(pageStyle.paddingBottom)
          + 48
        const availableHeight = page.clientHeight - reserved
        if (article.scrollHeight > availableHeight && blockCount > 1) {
          copy.remove()
          renderedPages.push(page)
          createPage()
          article.append(copy)
          blockCount = 1
        }
      }
      renderedPages.push(page)

    }
  }

  renderedPages.forEach((page, index) => {
    removeNativePageNumbers(page)
    const footer = document.createElement('div')
    footer.className = 'studio-page-number'
    footer.textContent = String(index + 1)
    page.append(footer)
  })

  const scaleFrames = () => {
    const scale = Math.min(56 * 16 / (210 * 96 / 25.4), container.clientWidth / (210 * 96 / 25.4))
    for (const page of renderedPages) {
      const frame = page.parentElement
      frame.style.width = `${210 * 96 / 25.4 * scale}px`
      frame.style.height = `${297 * 96 / 25.4 * scale}px`
      page.style.setProperty('transform', `scale(${scale})`, 'important')
    }
  }
  const observer = new ResizeObserver(scaleFrames)
  observer.observe(container)
  scaleFrames()

  return { count: renderedPages.length || 1, observer }
}

function removeNativePageNumbers(page) {
  page.querySelectorAll(':scope > footer').forEach((footer) => {
    const candidates = [...footer.querySelectorAll('p, span, div')].reverse()
    candidates.forEach((element) => {
      if (!element.children.length && /^\d+$/.test(element.textContent.trim())) element.remove()
    })
    const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT)
    const numberNodes = []
    while (walker.nextNode()) {
      if (/^\d+$/.test(walker.currentNode.nodeValue.trim())) numberNodes.push(walker.currentNode)
    }
    numberNodes.forEach((node) => node.remove())
  })
}

function renderTextPages(text) {
  const pageWidth = 1240
  const pageHeight = 1754
  const margin = 118
  const fontSize = 26
  const lineHeight = fontSize * 1.5
  const bottom = pageHeight - margin - 80
  const pages = []
  let canvas
  let context
  let y
  let pageNumber = 1
  const newPage = () => {
    canvas = document.createElement('canvas')
    canvas.width = pageWidth
    canvas.height = pageHeight
    context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, pageWidth, pageHeight)
    context.fillStyle = '#111827'
    context.font = `${fontSize}px Arial, "Noto Sans Armenian", sans-serif`
    y = margin + 18
    pages.push(canvas)
  }
  const drawFooter = () => {
    context.fillStyle = '#334155'
    context.font = '20px Arial, sans-serif'
    context.textAlign = 'center'
    context.fillText(String(pageNumber), pageWidth / 2, pageHeight - 48)
    context.textAlign = 'left'
  }
  newPage()
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ''
    const lines = []
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (context.measureText(candidate).width > pageWidth - margin * 2 && line) {
        lines.push(line)
        line = word
      } else line = candidate
    }
    if (line || !words.length) lines.push(line)
    for (const wrappedLine of lines) {
      if (y + lineHeight > bottom) {
        drawFooter()
        pageNumber += 1
        newPage()
      }
      context.fillText(wrappedLine, margin, y)
      y += lineHeight
    }
  }
  drawFooter()
  return pages
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png')
  })
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}
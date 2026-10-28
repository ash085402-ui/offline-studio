import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity, ArrowRight, BookOpen, Check,
  Cpu, Database, FileSpreadsheet, FileText, HardDrive, LockKeyhole, Menu, Pencil,
  Plus, Printer, Search, ShieldCheck, Sparkles, Trash2, Upload, X
} from 'lucide-react'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './App.css'
import './responsive.css'

const DB_NAME = 'offline-studio-v10'
const DB_VERSION = 1
const FILE_STORE = 'files'
const CONFIG_STORE = 'config'
const FILTERS = ['Բոլորը', 'Word', 'PDF', 'Excel', 'Փաստաթուղթ']

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
    // Continue with the Data URL fallback.
  }

  try {
    return await readBlobAsDataUrl(blob)
  } catch {
    // Use the Blob API if FileReader is unavailable or fails.
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
    // URL cleanup is best effort.
  }
}

export default function App() {
  const [activeView, setActiveView] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [files, setFiles] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [filter, setFilter] = useState('Բոլորը')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pageCount, setPageCount] = useState(1)
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
  const memoryFilesRef = useRef(new Map())
  const objectUrlsRef = useRef(new Map())
  const viewerRef = useRef(null)
  const previewRef = useRef(null)
  const fileInputRef = useRef(null)

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
    previewRef.current.replaceChildren(...clones)
  }, [previewOpen, pageCount, selectedId, busy])

  const visibleFiles = files.filter((file) => (
    (filter === 'Բոլորը' || file.kind === filter)
    && file.name.toLowerCase().includes(search.toLowerCase())
  ))

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
      setMessage(`${incoming.length} ֆայլ բացվեց։`)
    } catch (error) {
      console.error(error)
      setMessage('Ֆայլի հղումը չհաջողվեց ստեղծել։ Ընտրեք ֆայլը կրկին։')
    } finally {
      setBusy(false)
      input.value = ''
    }
  }

  const removeFile = async (event, id) => {
    event.stopPropagation()
    memoryFilesRef.current.delete(id)
    const fileUrl = objectUrlsRef.current.get(id)
    revokeFileUrl(fileUrl)
    objectUrlsRef.current.delete(id)
    setFiles((current) => current.filter((file) => file.id !== id))
    void deleteFile(id).catch(() => {})
    if (selectedId === id) setSelectedId(null)
    setMessage('Ֆայլը հեռացվեց այս աշխատաշրջանից։')
  }

  const saveEditedCopy = async () => {
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
  }

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

  const openPrintPreview = () => {
    if (!selectedFile) {
      setMessage('Նախ ընտրեք կամ բացեք փաստաթուղթը։')
      return
    }
    setPreviewOpen(true)
  }

  const closeSelectedFile = () => {
    setSelectedId(null)
    setEditing(false)
    setPreviewOpen(false)
  }

  const printDocument = () => window.print()
  const openCreateModal = () => {
    setNewDocTitle('')
    setNewDocText('')
    setNewDocFormat('docx')
    setCreateModalOpen(true)
  }

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
        .docx-page-frame { position: relative; flex: 0 0 auto; overflow: visible; }
        .docx-page-frame > section.docx { position: absolute !important; top: 0 !important; left: 0 !important; transform-origin: top left !important; margin: 0 !important; }
        .docx-page-frame > section.docx > .studio-title-footer { position: absolute !important; right: 20mm !important; bottom: 25mm !important; left: 20mm !important; width: auto !important; margin: 0 !important; text-align: center !important; }
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
          <button className={activeView === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('home'); setMenuOpen(false) }}><Activity size={17} /> Գլխավոր վահանակ</button>
          <button className={activeView === 'documents' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('documents'); setMenuOpen(false) }}><FileText size={17} /> Փաստաթղթեր <span className="nav-count">{files.length}</span></button>
          <button className="nav-item" onClick={() => { openCreateModal(); setMenuOpen(false) }}><Pencil size={17} /> Նոր փաստաթուղթ</button>
          <button className={activeView === 'security' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('security'); setMenuOpen(false) }}><ShieldCheck size={17} /> Անվտանգություն</button>
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
            <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Բացել ընտրացանկը"><Menu size={19} /></button>
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
            <aside className="file-rail">
              <div className="rail-heading"><div><p className="eyebrow">ՏԵՂԱՅԻՆ ՊԱՀՈՑ</p><h2>Փաստաթղթեր <span>{files.length}</span></h2></div><button className="icon-button accent-icon" onClick={() => fileInputRef.current?.click()} title="Ավելացնել ֆայլ"><Plus size={18} /></button></div>
              <label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Որոնել ֆայլերը" /></label>
              <div className="filter-list" role="group" aria-label="Ֆայլի տեսակ"><span className="filter-caption">ՏԵՍԱԿ</span>{FILTERS.map((item) => <button key={item} className={filter === item ? 'filter-chip filter-active' : 'filter-chip'} onClick={() => setFilter(item)}>{item}<span>{item === 'Բոլորը' ? files.length : files.filter((file) => file.kind === item).length}</span></button>)}</div>
              <div className="file-list">{visibleFiles.map((file) => <button key={file.id} className={selectedId === file.id ? 'file-row file-selected' : 'file-row'} onClick={() => setSelectedId(file.id)}><FileType kind={file.kind} /><span className="file-info"><b>{file.name}</b><small>{formatBytes(file.size)} · {new Date(file.addedAt).toLocaleDateString('hy-AM')}</small></span><span className="file-delete" role="button" tabIndex={0} title="Ջնջել ֆայլը" onClick={(event) => removeFile(event, file.id)} onKeyDown={(event) => event.key === 'Enter' && removeFile(event, file.id)}><Trash2 size={14} /></span></button>)}{visibleFiles.length === 0 && <div className="rail-empty"><FileText size={20} /><span>{files.length ? 'Համապատասխան ֆայլ չի գտնվել։' : 'Ավելացրեք առաջին փաստաթուղթը։'}</span></div>}</div>
              <button className="button button-outline rail-upload" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Ներմուծել ֆայլեր</button>
            </aside>
            <section className="viewer-area">
              <div className="viewer-toolbar"><div className="viewer-file-title">{!selectedFile && <span>Փաստաթուղթ ընտրված չէ</span>}</div><div className="viewer-meta">{selectedFile && <><span>{pageCount} էջ</span><span className="meta-divider" />A4</>}</div></div>
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
          <section className="preview-modal"><header className="preview-header"><div><p className="eyebrow">ՏՊՄԱՆ ՆԱԽԱԴԻՏՈՒՄ</p><h2 id="preview-title">{selectedFile?.name}</h2><span className="preview-count">{pageCount} էջ <b>•</b> A4</span></div><button className="icon-button" onClick={() => setPreviewOpen(false)} aria-label="Փակել նախադիտումը"><X size={19} /></button></header><div className="preview-scroll"><div ref={previewRef} className="preview-pages" /></div><footer className="preview-actions"><span>Բրաուզերի տպման պատուհանում ընտրեք «Save as PDF»՝ PDF ստանալու համար։</span><div><button className="button button-quiet" onClick={() => setPreviewOpen(false)}>Փակել</button><button className="button button-primary" onClick={printDocument}><Printer size={15} /> Տպել</button></div></footer></section>
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

  for (const [sourcePageIndex, sourcePage] of sourcePages.entries()) {
    const articles = [...sourcePage.children].filter((child) => child.tagName === 'ARTICLE')
    if (!articles.length) {
      wrapper.append(sourcePage)
      renderedPages.push(sourcePage)
      continue
    }

    for (const sourceArticle of articles) {
      let titleBlock = null
      const blocks = [...sourceArticle.children].filter((block) => {
        const titleText = block.textContent.replace(/\s+/g, ' ').trim()
        if (sourcePageIndex === 0 && !titleBlock && /^գյումրի\s+2026$/iu.test(titleText)) {
          titleBlock = block
          return false
        }
        return true
      })
      const firstRenderedPageIndex = renderedPages.length
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

      if (titleBlock && renderedPages[firstRenderedPageIndex]) {
        const title = titleBlock.cloneNode(true)
        title.classList.add('studio-title-footer')
        title.querySelectorAll('*').forEach((element) => element.style.setProperty('color', '#111827', 'important'))
        title.style.setProperty('color', '#111827', 'important')
        renderedPages[firstRenderedPageIndex].append(title)
      }
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
    const scale = Math.min(1, container.clientWidth / (210 * 96 / 25.4))
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
  const lineHeight = 38
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
    context.font = '26px Arial, "Noto Sans Armenian", sans-serif'
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

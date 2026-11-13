import { useCallback, useEffect, useRef, useState } from 'react'
import { DesktopStudio } from './components/DesktopStudio'
import { MobileStudio } from './components/MobileStudio'
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
    transaction.oncomplete = () => { database.close(); resolve(result) }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
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

async function createSafeFileUrl(blob) {
  try { return URL.createObjectURL(blob) } catch { return null }
}

function revokeFileUrl(url) {
  if (!url?.startsWith('blob:')) return
  try { URL.revokeObjectURL(url) } catch { }
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

function paginateDocxPages(container) {
  const wrapper = container.querySelector('.docx-wrapper')
  if (!wrapper) return { count: 1, observer: null }

  const sourcePages = [...wrapper.querySelectorAll(':scope > section.docx')]
  if (!sourcePages.length) return { count: 1, observer: null }

  wrapper.style.setProperty('display', 'flex', 'important')
  wrapper.style.setProperty('flex-direction', 'column', 'important')
  wrapper.style.setProperty('align-items', 'center', 'important')
  wrapper.style.setProperty('gap', '16px', 'important')
  wrapper.style.setProperty('width', '100%', 'important')
  wrapper.style.setProperty('padding', '0', 'important')
  wrapper.style.setProperty('box-sizing', 'border-box', 'important')

  const isHeadingBlock = (block) => {
    if (/^H[1-6]$/.test(block.tagName) || /heading/i.test(String(block.className))) return true
    const textLength = block.textContent.trim().length
    if (!textLength) return false
    const boldLength = [...block.querySelectorAll('strong, b, [style*="font-weight"]')]
      .filter((run) => run.style.fontWeight === 'bold' || Number.parseInt(run.style.fontWeight || getComputedStyle(run).fontWeight, 10) >= 600)
      .reduce((length, run) => length + run.textContent.trim().length, 0)
    return boldLength / textLength >= 0.65
  }

  const groupsFor = (blocks) => {
    const groups = []
    for (let index = 0; index < blocks.length; index += 1) {
      const group = [blocks[index]]
      if (isHeadingBlock(blocks[index]) && index + 1 < blocks.length) {
        let next = index + 1
        while (next < blocks.length && !blocks[next].textContent.trim()) {
          group.push(blocks[next])
          next += 1
        }
        if (next < blocks.length) group.push(blocks[next])
        index = next
      }
      groups.push(group)
    }
    return groups
  }

  const paginatedPages = []
  for (const sourcePage of sourcePages) {
    const computed = getComputedStyle(sourcePage)
    const pageWidth = sourcePage.style.width || computed.width || '210mm'
    const pagePadding = sourcePage.style.padding || computed.padding
    const pageHeight = sourcePage.style.height && sourcePage.style.height !== 'auto'
      ? sourcePage.style.height
      : sourcePage.style.minHeight || computed.minHeight || '297mm'
    sourcePage.style.setProperty('width', pageWidth, 'important')
    sourcePage.style.setProperty('min-width', pageWidth, 'important')
    sourcePage.style.setProperty('max-width', 'none', 'important')
    sourcePage.style.setProperty('height', pageHeight, 'important')
    sourcePage.style.setProperty('padding', pagePadding, 'important')
    sourcePage.style.setProperty('margin', '0', 'important')

    const originalChildren = [...sourcePage.childNodes]
    const articles = originalChildren.filter((child) => child.nodeType === Node.ELEMENT_NODE && child.tagName === 'ARTICLE')
    if (!articles.length || sourcePage.scrollHeight <= sourcePage.clientHeight + 1) {
      paginatedPages.push(sourcePage)
      continue
    }

    const blocksByArticle = articles.map((article) => [...article.children])
    const groupsByArticle = blocksByArticle.map(groupsFor)
    const template = sourcePage.cloneNode(false)
    const deferredChildren = []
    const pageList = []

    const createPage = (reuseSourcePage = false) => {
      const page = reuseSourcePage ? sourcePage : template.cloneNode(false)
      if (!reuseSourcePage) wrapper.append(page)
      page.replaceChildren()
      const pageArticles = []
      originalChildren.forEach((child) => {
        const articleIndex = articles.indexOf(child)
        if (articleIndex >= 0) {
          const article = reuseSourcePage ? child : child.cloneNode(false)
          article.replaceChildren()
          page.append(article)
          pageArticles[articleIndex] = article
        } else if (child.nodeType === Node.ELEMENT_NODE && /^(HEADER|FOOTER)$/.test(child.tagName)) {
          page.append(reuseSourcePage ? child : child.cloneNode(true))
        } else if (child.nodeType === Node.ELEMENT_NODE && /footnote|endnote/i.test(String(child.className))) {
          if (!deferredChildren.includes(child)) deferredChildren.push(child)
        } else if (reuseSourcePage) {
          page.append(child)
        }
      })
      const current = { page, articles: pageArticles, hasContent: false }
      pageList.push(current)
      return current
    }

    const exceedsPage = (currentPage, articleIndex) => {
      const article = currentPage.articles[articleIndex]
      const pageStyle = getComputedStyle(currentPage.page)
      const availableHeight = currentPage.page.clientHeight - article.offsetTop - (Number.parseFloat(pageStyle.paddingBottom) || 0)
      return article.scrollHeight > availableHeight + 1
    }

    let currentPage = createPage(true)
    for (let articleIndex = 0; articleIndex < articles.length; articleIndex += 1) {
      const groups = groupsByArticle[articleIndex]
      for (const group of groups) {
        const targetArticle = currentPage.articles[articleIndex]
        group.forEach((block) => targetArticle.append(block))

        if (!exceedsPage(currentPage, articleIndex) || !currentPage.hasContent) {
          currentPage.hasContent = true
          continue
        }

        group.forEach((block) => block.remove())
        currentPage = createPage()
        group.forEach((block) => currentPage.articles[articleIndex].append(block))
        currentPage.hasContent = true
      }
    }

    deferredChildren.forEach((child) => pageList[pageList.length - 1].page.append(child))
    paginatedPages.push(...pageList.map(({ page }) => page))
  }

  paginatedPages.forEach((page) => wrapper.append(page))

  const pageMetrics = paginatedPages.map((page) => {
    page.style.setProperty('margin', '0', 'important')
    page.style.setProperty('flex', '0 0 auto', 'important')
    page.style.setProperty('transform-origin', 'top center', 'important')
    page.style.setProperty('transform', 'scale(1)', 'important')
    const width = page.offsetWidth
    const height = page.offsetHeight
    return { page, width, height }
  })

  const scalePages = () => {
    const availableWidth = container.clientWidth - 24
    if (availableWidth <= 0) return

    pageMetrics.forEach(({ page, width, height }) => {
      const scale = Math.min(1, availableWidth / width)
      page.style.setProperty('transform', `scale(${scale})`, 'important')
      page.style.setProperty('margin-bottom', `${height * (scale - 1)}px`, 'important')
    })
  }

  const observer = new ResizeObserver(scalePages)
  observer.observe(container)
  scalePages()

  return { count: pageMetrics.length, observer }
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
  const [isMobileDevice, setIsMobileDevice] = useState(window.innerWidth <= 768)

  const memoryFilesRef = useRef(new Map())
  const objectUrlsRef = useRef(new Map())
  const viewerRef = useRef(null)
  const previewRef = useRef(null)
  const fileMenuRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const handleResize = () => setIsMobileDevice(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const refreshFiles = useCallback(async () => {
    let storedRecords = []
    try { storedRecords = await listFiles() } catch (error) { console.warn(error) }
    const recordsById = new Map(storedRecords.map((r) => [r.id, r]))
    for (const [id, r] of memoryFilesRef.current) recordsById.set(id, r)
    const records = [...recordsById.values()]
    records.sort((a, b) => b.addedAt - a.addedAt)
    setFiles(records)
  }, [])

  const saveFileRecord = (record) => {
    memoryFilesRef.current.set(record.id, record)
    const persistedRecord = { ...record }
    delete persistedRecord.fileUrl
    try { void putFile(persistedRecord).catch(() => { }) } catch { }
  }

  const getFileUrl = async (record) => {
    const currentUrl = objectUrlsRef.current.get(record.id)
    if (currentUrl) return currentUrl
    const blob = blobFromRecord(record)
    if (!blob) return null
    const fileUrl = await createSafeFileUrl(blob)
    if (!fileUrl) return null
    objectUrlsRef.current.set(record.id, fileUrl)
    return fileUrl
  }

  useEffect(() => {
    refreshFiles().catch(() => { })
  }, [refreshFiles])

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
        let record = memoryFilesRef.current.get(selectedId) || await getFile(selectedId)
        if (!record || cancelled) return
        const fileUrl = await getFileUrl(record)
        if (!fileUrl) return
        const effectiveKind = record.type === 'image/png' ? 'PNG' : record.kind
        setBusy(true)
        setEditing(false)
        setPageCount(1)
        setSelectedFile({ ...record, fileUrl, kind: effectiveKind })
        const kind = effectiveKind

        if (kind === 'Word' && record.name.toLowerCase().endsWith('.docx')) {
          const response = await fetch(fileUrl)
          if (!response.ok) throw new Error('Unable to access DOCX')
          const buffer = await response.arrayBuffer()
          const docxViewer = await import('docx-preview')
          if (viewerRef.current) {
            viewerRef.current.replaceChildren()
            await docxViewer.renderAsync(buffer.slice(0), viewerRef.current, undefined, {
              inWrapper: true, ignoreWidth: false, ignoreHeight: false, breakPages: true,
              ignoreLastRenderedPageBreak: false
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
          const pdf = await pdfjs.getDocument({ url: fileUrl }).promise
          if (cancelled || !viewerRef.current) return
          viewerRef.current.replaceChildren()
          setPageCount(pdf.numPages)
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 1.15 })
            const canvas = document.createElement('canvas')
            canvas.className = 'pdf-canvas'
            canvas.width = viewport.width
            canvas.height = viewport.height
            await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
            const sheet = document.createElement('section')
            sheet.className = 'pdf-sheet paper-page'
            sheet.style.aspectRatio = `${viewport.width} / ${viewport.height}`
            sheet.append(canvas)
            viewerRef.current.append(sheet)
          }
        } else if (kind === 'Excel') {
          const response = await fetch(fileUrl)
          const buffer = await response.arrayBuffer()
          const { default: ExcelJS } = await import('exceljs')
          const workbook = new ExcelJS.Workbook()
          await workbook.xlsx.load(buffer.slice(0))
          const sheet = workbook.worksheets[0]
          const rows = []
          sheet.eachRow({ includeEmpty: true }, (row) => {
            rows.push(`<tr>${row.values.slice(1).map((val) => `<td>${escapeHtml(String(val ?? ''))}</td>`).join('')}</tr>`)
          })
          viewerRef.current.innerHTML = `<section class="spreadsheet-page paper-page"><table id="sheet-table"><tbody>${rows.join('')}</tbody></table></section>`
          setPageCount(1)
        } else {
          const response = await fetch(fileUrl)
          const text = await response.text()
          setTextContent(text)
          if (viewerRef.current) {
            viewerRef.current.innerHTML = `<section class="text-page paper-page"><article>${escapeHtml(text).replace(/\n/g, '<br>')}</article></section>`
          }
          setPageCount(1)
        }
      } catch (e) {
        console.error(e)
        setMessage('Ֆայլը չհաջողվեց բացել։')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    load()
    return () => { cancelled = true; pageResizeObserver?.disconnect() }
  }, [selectedId, isMobileDevice])

  const handleUpload = async (event) => {
    const input = event.currentTarget
    const incoming = [...(input.files || [])]
    if (!incoming.length) return
    setBusy(true)
    try {
      for (const file of incoming) {
        const fileUrl = await createSafeFileUrl(file)
        const record = { id: crypto.randomUUID(), name: file.name, kind: classifyFile(file), size: file.size, type: file.type, addedAt: Date.now(), blob: file, fileUrl }
        saveFileRecord(record)
        setSelectedId(record.id)
      }
      await refreshFiles()
      setActiveView('documents')
    } finally {
      setBusy(false)
      input.value = ''
    }
  }

  const saveEditedCopy = useCallback(() => { }, [])
  const openPrintPreview = () => setPreviewOpen(true)
  const closeSelectedFile = () => setSelectedId(null)
  const openCreateModal = () => setCreateModalOpen(true)
  const createDocument = () => { }
  const createPin = () => { }
  const unlock = () => { }
  const removePin = () => { }
  const replaceAllMatches = () => { }
  const moveFindResult = () => { }
  const navigateToPage = () => { }
  const printDocument = () => { }
  const changePreviewPage = () => { }
  const openFindPanel = () => { }
  const toggleEditing = () => setEditing(!editing)
  const removeFile = (id) => setFiles(files.filter(f => f.id !== id))
  const saveRename = () => { }

  if (isMobileDevice) {
    return (
      <MobileStudio
        files={files} selectedId={selectedId} setSelectedId={setSelectedId}
        activeView={activeView} setActiveView={setActiveView} search={search} setSearch={setSearch}
        busy={busy} message={message} setMessage={setMessage} pageCount={pageCount}
        editing={editing} toggleEditing={toggleEditing} saveEditedCopy={saveEditedCopy}
        openPrintPreview={openPrintPreview} closeSelectedFile={closeSelectedFile}
        fileInputRef={fileInputRef} handleUpload={handleUpload} viewerRef={viewerRef}
        fileDrawerOpen={fileDrawerOpen} setFileDrawerOpen={setFileDrawerOpen}
        menuOpen={menuOpen} setMenuOpen={setMenuOpen} formatBytes={formatBytes}
        FILE_CATEGORIES={FILE_CATEGORIES} openCategories={openCategories}
        setOpenCategories={setOpenCategories} resourceMemory={resourceMemory}
      />
    )
  }

  return (
    <DesktopStudio
      files={files} selectedId={selectedId} setSelectedId={setSelectedId}
      activeView={activeView} setActiveView={setActiveView} search={search} setSearch={setSearch}
      busy={busy} message={message} setMessage={setMessage} pageCount={pageCount}
      editing={editing} toggleEditing={toggleEditing} saveEditedCopy={saveEditedCopy}
      openPrintPreview={openPrintPreview} closeSelectedFile={closeSelectedFile}
      fileInputRef={fileInputRef} handleUpload={handleUpload} viewerRef={viewerRef}
      findOpen={findOpen} setFindOpen={setFindOpen} findMode={findMode} openFindPanel={openFindPanel}
      findQuery={findQuery} setFindQuery={setFindQuery} findCount={findCount} findIndex={findIndex}
      replaceQuery={replaceQuery} setReplaceQuery={setReplaceQuery} replaceAllMatches={replaceAllMatches}
      moveFindResult={moveFindResult} goToPage={goToPage} setGoToPage={setGoToPage} navigateToPage={navigateToPage}
      paperSize={paperSize} previewOpen={previewOpen} setPreviewOpen={setPreviewOpen} previewPage={previewPage}
      changePreviewPage={changePreviewPage} copies={copies} setCopies={setCopies} pageRange={pageRange}
      setPageRange={setPageRange} printDocument={printDocument} previewRef={previewRef}
      createModalOpen={createModalOpen} setCreateModalOpen={setCreateModalOpen} openCreateModal={openCreateModal}
      createDocument={createDocument} newDocTitle={newDocTitle} setNewDocTitle={setNewDocTitle} newDocText={newDocText}
      setNewDocText={setNewDocText} newDocFormat={newDocFormat} setNewDocFormat={setNewDocFormat}
      pinHash={pinHash} createPin={createPin} unlock={unlock} removePin={removePin} pinInput={pinInput}
      setPinInput={setPinInput} pinSetup={pinSetup} setPinSetup={setPinSetup} resourceMemory={resourceMemory}
      formatBytes={formatBytes} FILE_CATEGORIES={FILE_CATEGORIES} PAPER_SIZES={PAPER_SIZES}
      openCategories={openCategories} setOpenCategories={setOpenCategories} renamingId={renamingId}
      renameValue={renameValue} setRenameValue={setRenameValue} saveRename={saveRename} removeFile={removeFile}
      openFileMenuId={openFileMenuId} setOpenFileMenuId={setOpenFileMenuId} fileMenuRef={fileMenuRef}
    />
  )
}
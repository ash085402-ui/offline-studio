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
    const load = async () => {
      try {
        let record = memoryFilesRef.current.get(selectedId) || await getFile(selectedId)
        if (!record || cancelled) return
        const fileUrl = await getFileUrl(record)
        if (!fileUrl) return
        setBusy(true)
        setSelectedFile({ ...record, fileUrl })
        if (record.kind === 'PDF') {
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
            canvas.width = viewport.width
            canvas.height = viewport.height
            await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
            const sheet = document.createElement('section')
            sheet.className = 'pdf-sheet paper-page'
            sheet.append(canvas)
            viewerRef.current.append(sheet)
          }
        }
      } catch (e) {
        console.error(e)
        setMessage('Ֆայլը չհաջողվեց բեռնել։')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedId])

  const handleUpload = async (event) => {
    const incoming = [...(event.currentTarget.files || [])]
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
      event.currentTarget.value = ''
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
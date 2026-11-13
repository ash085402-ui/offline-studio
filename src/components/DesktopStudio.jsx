import React from 'react'
import {
  Activity, ChevronDown, Database, Ellipsis, FileText, Pencil, Printer, Search,
  ShieldCheck, Sparkles, Upload, X
} from 'lucide-react'
import { CreateDocumentModal } from './CreateDocumentModal'

export function DesktopStudio({
  files, selectedId, setSelectedId, activeView, setActiveView, search, setSearch,
  busy, message, setMessage, pageCount, editing, toggleEditing,
  openPrintPreview, closeSelectedFile, fileInputRef, handleUpload, viewerRef,
  findOpen, setFindOpen, findMode, openFindPanel, findQuery, setFindQuery,
  findCount, findIndex, replaceQuery, setReplaceQuery, replaceAllMatches,
  moveFindResult, goToPage, setGoToPage, navigateToPage, paperSize,
  previewOpen, setPreviewOpen, previewPage, changePreviewPage, copies, setCopies,
  pageRange, setPageRange, printDocument, previewRef, createModalOpen, setCreateModalOpen,
  openCreateModal, createDocument, newDocTitle, setNewDocTitle, newDocText,
  setNewDocText, newDocFormat, setNewDocFormat, newDocOutputFormat, setNewDocOutputFormat, pinHash, createPin, unlock,
  removePin, pinInput, setPinInput, pinSetup, setPinSetup, resourceMemory,
  formatBytes, FILE_CATEGORIES, PAPER_SIZES, openCategories, setOpenCategories,
  formatMenuOpen, setFormatMenuOpen, fileCategory, setFileCategory,
  renamingId, renameValue, setRenameValue, saveRename, removeFile, openFileMenuId,
  setOpenFileMenuId, fileMenuRef
}) {
  return (
    <div className="desktop-studio-wrapper" style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <aside className="sidebar sidebar-desktop">
        <div className="brand-row">
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span className="brand-name">OFFLINE <b>STUDIO</b><small>DESKTOP WORKSPACE</small></span>
        </div>
        <div className="side-label">ԱՇԽԱՏԱՏԱՐԱԾՔ (ԿՈՄՊՅՈՒՏԵՐ)</div>
        <nav className="section-nav" aria-label="Հիմնական ընտրացանկ">
          <button className={activeView === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('home')}><Activity size={17} /> Գլխավոր վահանակ</button>
          <button className={activeView === 'documents' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('documents')}><FileText size={17} /> Փաստաթղթեր <span className="nav-count">{files.length}</span></button>
          {activeView !== 'home' && <button className="nav-item" onClick={openCreateModal}><Pencil size={17} /> Նոր փաստաթուղթ</button>}
          <button className={activeView === 'security' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('security')}><ShieldCheck size={17} /> Անվտանգություն</button>
        </nav>
        <div className="side-storage">
          <div className="storage-head"><span><Database size={15} /> Տեղային պահոց</span><span className="online-dot" /></div>
          <strong>{files.length} <small>ֆայլ</small></strong>
          <p>Պահվում է միայն սարքում՝ IndexedDB-ում։</p>
        </div>
        <div className="side-bottom"><span className="status-dot" /> Դեսկթոփ ռեժիմ <span className="version">v10.0</span></div>
      </aside>

      <main className="main-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header className="topbar">
          <div className="topbar-leading">
            {activeView === 'documents' ? (
              <div className="format-menu-anchor">
                <button className="icon-button format-menu-trigger" onClick={() => setFormatMenuOpen(!formatMenuOpen)} aria-label="Ֆայլերի ձևաչափեր" aria-expanded={formatMenuOpen}><Ellipsis size={20} /></button>
                {formatMenuOpen && <div className="format-menu" role="menu">
                  <p>Ֆայլերի ձևաչափեր</p>
                  <button role="menuitem" onClick={() => { setFileCategory('all'); setOpenCategories(Object.fromEntries(FILE_CATEGORIES.map((item) => [item.id, true]))); setSearch(''); setFormatMenuOpen(false) }}><span>Բոլոր ձևաչափերը</span><small>{files.length}</small></button>
                  {FILE_CATEGORIES.map((category) => <button key={category.id} role="menuitem" onClick={() => { setFileCategory(category.id); setOpenCategories(Object.fromEntries(FILE_CATEGORIES.map((item) => [item.id, item.id === category.id]))); setSearch(''); setFormatMenuOpen(false) }}>
                    <span>{category.label}</span><small>{files.filter((file) => category.kinds.includes(file.kind)).length}</small>
                  </button>)}
                </div>}
                <span className="studio-wordmark">Offline Studio</span>
              </div>
            ) : <span className="topbar-path">DESKTOP STUDIO <span>/</span> {activeView.toUpperCase()}</span>}
          </div>
          <div className="topbar-actions">
            {activeView === 'documents' && selectedId && (
              <>
                <button className={`button ${editing ? 'button-primary icon-only' : 'button-quiet'}`} onClick={toggleEditing} title={editing ? 'Ավարտել խմբագրումը' : 'Խմբագրել'} aria-label={editing ? 'Ավարտել խմբագրումը' : 'Խմբագրել'}>{editing ? <X size={16} /> : <><Pencil size={15} /><span>Խմբագրել</span></>}</button>
                <button className="button button-primary compact-button" onClick={openPrintPreview}><Printer size={15} /><span>Տպել / PDF</span></button>
                <button className="button button-quiet" onClick={closeSelectedFile} title="Փակել"><X size={15} /></button>
              </>
            )}
            {activeView === 'documents' && <>
              <button className="button button-quiet" onClick={() => fileInputRef.current?.click()}><Upload size={15} /><span>Բացել ֆայլ</span></button>
              <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.rtf,.png,.jpg,.jpeg" onChange={handleUpload} />
            </>}
          </div>
        </header>

        {message && <div className="notice" role="status"><span>{message}</span><button className="icon-button" onClick={() => setMessage('')}><X size={15} /></button></div>}

        {activeView === 'home' && (
          <div className="welcome-page">
            <section className="welcome-stage">
              <div className="welcome-copy-block">
                <p className="eyebrow">ԱՆՑԱՆՑԻՑ ԱՆԿԱԽ ՓԱՍՏԱԹՂԹԱՅԻՆ ՍՏՈՒԴԻԱ</p>
                <h1>Աշխատեք ձեր փաստաթղթերի հետ՝ <span>ձեր պայմաններով։</span></h1>
                <p>Offline Studio-ն մեկ հանգիստ և անվտանգ միջավայր է՝ փաստաթղթեր դիտելու, խմբագրելու և ստեղծելու համար։ Ձեր աշխատանքային ֆայլերը մնում են այս սարքում և հասանելի են նաև առանց ինտերնետի։</p>
              </div>
              <div className="welcome-visual" aria-hidden="true">
                <div className="welcome-paper welcome-paper-back"><i /><i /><i /></div>
                <div className="welcome-paper welcome-paper-front"><span className="welcome-paper-mark"><Sparkles size={18} /></span><b>Offline<br />Studio</b><i /><i /><i /></div>
                <div className="welcome-format format-word">WORD</div><div className="welcome-format format-pdf">PDF</div><div className="welcome-format format-sheet">XLS</div>
              </div>
            </section>
            <section className="welcome-values" aria-label="Offline Studio-ի առանձնահատկությունները">
              <article><span>01</span><div><h2>Տեղային պահոց</h2><p>Ֆայլերը պահպանվում են ձեր սարքում՝ առանց ամպային փոխանցման։</p></div></article>
              <article><span>02</span><div><h2>Միասնական աշխատատարածք</h2><p>Word, PDF, Excel և պատկերներ՝ մեկ ընթեռնելի միջավայրում։</p></div></article>
              <article><span>03</span><div><h2>Պատրաստ՝ անցանց աշխատանքի</h2><p>Բացեք և կառավարեք ձեր ֆայլերը՝ նույնիսկ առանց ցանցային կապի։</p></div></article>
            </section>
          </div>
        )}

        {activeView === 'documents' && (
          <div className="document-workspace" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <aside className="file-rail" style={{ width: '320px', borderRight: '1px solid rgba(148,163,184,0.1)', display: 'flex', flexDirection: 'column' }}>
              <div className="rail-heading"><div><p className="eyebrow">ԱՐԽԻՎ</p><h2>Ֆայլեր <span>{files.length}</span></h2></div></div>
              <label className="search-box"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Որոնել" /></label>
              <div className="category-list" style={{ flex: 1, overflowY: 'auto' }}>
                {FILE_CATEGORIES.filter((category) => fileCategory === 'all' || category.id === fileCategory).map((category) => {
                  const categoryFiles = files.filter((f) => category.kinds.includes(f.kind) && f.name.toLowerCase().includes(search.toLowerCase()))
                  const isOpen = Boolean(openCategories[category.id])
                  return (
                    <div className="file-category" key={category.id}>
                      <button className="category-toggle" onClick={() => setOpenCategories((c) => ({ ...c, [category.id]: !c[category.id] }))}>
                        <span><ChevronDown size={14} className={isOpen ? 'category-chevron is-open' : 'category-chevron'} />{category.label}</span>
                        <span className="category-count">{categoryFiles.length}</span>
                      </button>
                      {isOpen && <div className="file-list">
                        {categoryFiles.map((file) => (
                          <div key={file.id} className={`file-row ${selectedId === file.id ? 'file-selected' : ''}`}>
                            <button className="file-open" onClick={() => setSelectedId(file.id)}>
                              <FileText size={15} />
                              <span className="file-info"><b>{file.name}</b><small>{formatBytes(file.size)}</small></span>
                            </button>
                          </div>
                        ))}
                      </div>}
                    </div>
                  )
                })}
              </div>
            </aside>
            <section className="viewer-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#070b14' }}>
              <div className="paper-stage" style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
                <div ref={viewerRef} className={`document-pages ${selectedId ? '' : 'is-empty'} ${editing ? 'is-editing' : ''}`} />
              </div>
            </section>
          </div>
        )}

        {activeView === 'security' && (
          <div className="page-content security-page">
            <h1 style={{ color: '#fff' }}>Անվտանգություն և Կարգավորումներ</h1>
            <p>Տվյալները պահվում են բացառապես ձեր համակարգչի IndexedDB-ում։</p>
          </div>
        )}
      </main>
      <CreateDocumentModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onCreate={createDocument}
        title={newDocTitle} setTitle={setNewDocTitle} text={newDocText} setText={setNewDocText}
        paperFormat={newDocFormat} setPaperFormat={setNewDocFormat} outputFormat={newDocOutputFormat} setOutputFormat={setNewDocOutputFormat} paperSizes={PAPER_SIZES} creating={busy} />
    </div>
  )
}
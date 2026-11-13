import React from 'react'
import {
  Activity, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, EllipsisVertical,
  Cpu, Database, FileSpreadsheet, FileText, HardDrive, LockKeyhole, Menu, Pencil,
  Plus, Printer, Search, ShieldCheck, Sparkles, Upload, X
} from 'lucide-react'

export function DesktopStudio({
  files, selectedId, setSelectedId, activeView, setActiveView, search, setSearch,
  busy, message, setMessage, pageCount, editing, toggleEditing, saveEditedCopy,
  openPrintPreview, closeSelectedFile, fileInputRef, handleUpload, viewerRef,
  findOpen, setFindOpen, findMode, openFindPanel, findQuery, setFindQuery,
  findCount, findIndex, replaceQuery, setReplaceQuery, replaceAllMatches,
  moveFindResult, goToPage, setGoToPage, navigateToPage, paperSize,
  previewOpen, setPreviewOpen, previewPage, changePreviewPage, copies, setCopies,
  pageRange, setPageRange, printDocument, previewRef, createModalOpen, setCreateModalOpen,
  openCreateModal, createDocument, newDocTitle, setNewDocTitle, newDocText,
  setNewDocText, newDocFormat, setNewDocFormat, pinHash, createPin, unlock,
  removePin, pinInput, setPinInput, pinSetup, setPinSetup, resourceMemory,
  formatBytes, FILE_CATEGORIES, PAPER_SIZES, openCategories, setOpenCategories,
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
          <button className="nav-item" onClick={openCreateModal}><Pencil size={17} /> Նոր փաստաթուղթ</button>
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
            <span className="topbar-path">DESKTOP STUDIO <span>/</span> {activeView.toUpperCase()}</span>
          </div>
          <div className="topbar-actions">
            {activeView === 'documents' && selectedId && (
              <>
                <button className={`button button-quiet ${editing ? 'is-editing' : ''}`} onClick={toggleEditing}><Pencil size={15} /><span>{editing ? 'Խմբագրում' : 'Խմբագրել'}</span></button>
                {editing && <button className="button button-primary compact-button" onClick={saveEditedCopy}><Check size={15} /><span>Պահել պատճենը</span></button>}
                <button className="button button-primary compact-button" onClick={openPrintPreview}><Printer size={15} /><span>Տպել / PDF</span></button>
                <button className="button button-quiet" onClick={closeSelectedFile} title="Փակել"><X size={15} /></button>
              </>
            )}
            <button className="button button-quiet" onClick={() => fileInputRef.current?.click()}><Upload size={15} /><span>Բացել ֆայլ</span></button>
            <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.rtf,.png" onChange={handleUpload} />
          </div>
        </header>

        {message && <div className="notice" role="status"><span>{message}</span><button className="icon-button" onClick={() => setMessage('')}><X size={15} /></button></div>}

        {activeView === 'home' && (
          <div className="page-content home-page">
            <section className="welcome-row">
              <div><p className="eyebrow">DESKTOP WORKSPACE <span className="eyebrow-mark">/ 10.0</span></p><h1>Փաստաթղթերը՝ <span>ձեր վերահսկողության տակ։</span></h1><p className="welcome-copy">Լիարժեք ստուդիային բնորոշ աշխատատարածք մեծ էկրանների համար։</p></div>
              <button className="button button-primary start-button" onClick={() => setActiveView('documents')}><BookOpen size={16} /> Բացել աշխատատարածքը <ArrowRight size={15} /></button>
            </section>
            <section className="resource-strip">
              <div className="resource-heading"><div className="resource-orbit"><Activity size={18} /></div><div><strong>Համակարգչի մոնիտոր</strong><small>Desktop Environment</small></div></div>
              <div className="resource-metric"><div className="metric-title"><Cpu size={15} /> CPU</div><div className="meter"><i className={busy ? 'meter-busy' : ''} /></div><small>{busy ? 'Մշակվում է' : 'Ազատ'}</small></div>
              <div className="resource-metric"><div className="metric-title"><HardDrive size={15} /> RAM <span className="metric-value">{formatBytes(resourceMemory)}</span></div><div className="meter meter-blue"><i style={{ width: '45%' }} /></div><small>Օպտիմալ</small></div>
            </section>
          </div>
        )}

        {activeView === 'documents' && (
          <div className="document-workspace" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <aside className="file-rail" style={{ width: '320px', borderRight: '1px solid rgba(148,163,184,0.1)', display: 'flex', flexDirection: 'column' }}>
              <div className="rail-heading"><div><p className="eyebrow">ԱՐԽԻՎ</p><h2>Ֆայլեր <span>{files.length}</span></h2></div></div>
              <label className="search-box"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Որոնել" /></label>
              <div className="category-list" style={{ flex: 1, overflowY: 'auto' }}>
                {FILE_CATEGORIES.map((category) => {
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
                {!selectedId && <div className="viewer-empty"><h2>Ընտրեք ֆայլ դիտելու համար</h2></div>}
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
    </div>
  )
}
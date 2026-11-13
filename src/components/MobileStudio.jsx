import React from 'react'
import {
  Activity, Ellipsis, FilePlus2, FileText, Menu, Printer, ShieldCheck, Sparkles, Upload, X
} from 'lucide-react'
import { CreateDocumentModal } from './CreateDocumentModal'

export function MobileStudio({
  files, selectedId, setSelectedId, activeView, setActiveView, search, setSearch,
  busy, message, setMessage, pageCount, editing, toggleEditing,
  openPrintPreview, closeSelectedFile, fileInputRef, handleUpload, viewerRef,
  fileDrawerOpen, setFileDrawerOpen, menuOpen, setMenuOpen, formatBytes,
  FILE_CATEGORIES, openCategories, setOpenCategories, resourceMemory, createModalOpen, setCreateModalOpen,
  createDocument, newDocTitle, setNewDocTitle, newDocText, setNewDocText,
  newDocFormat, setNewDocFormat, newDocOutputFormat, setNewDocOutputFormat, PAPER_SIZES,
  formatMenuOpen, setFormatMenuOpen, fileCategory, setFileCategory
}) {
  return (
    <div className="mobile-studio-wrapper" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <header className="topbar" style={{ padding: '0 12px', height: '56px' }}>
        <div className="topbar-leading" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Մենյու"><Menu size={20} /></button>
          {activeView === 'documents' ? <div className="format-menu-anchor">
            <button className="icon-button format-menu-trigger" onClick={() => setFormatMenuOpen(!formatMenuOpen)} aria-label="Ֆայլերի ձևաչափեր" aria-expanded={formatMenuOpen}><Ellipsis size={20} /></button>
            {formatMenuOpen && <div className="format-menu" role="menu">
              <p>Ֆայլերի ձևաչափեր</p>
              <button role="menuitem" onClick={() => { setFileCategory('all'); setFileDrawerOpen(true); setMenuOpen(false); setFormatMenuOpen(false) }}><span>Բոլոր ձևաչափերը</span><small>{files.length}</small></button>
              {FILE_CATEGORIES.map((category) => <button key={category.id} role="menuitem" onClick={() => { setFileCategory(category.id); setFileDrawerOpen(true); setMenuOpen(false); setFormatMenuOpen(false) }}><span>{category.label}</span><small>{files.filter((file) => category.kinds.includes(file.kind)).length}</small></button>)}
            </div>}
            <span className="studio-wordmark">Offline Studio</span>
          </div> : <span className="topbar-path" style={{ fontSize: '13px' }}><b>MOBILE</b> / {activeView.toUpperCase()}</span>}
        </div>
        <div className="topbar-actions">
          {activeView === 'documents' && selectedId && (
            <>
              <button className={`button ${editing ? 'button-primary icon-only' : 'button-quiet'}`} onClick={toggleEditing} title={editing ? 'Ավարտել խմբագրումը' : 'Խմբագրել'} aria-label={editing ? 'Ավարտել խմբագրումը' : 'Խմբագրել'}>{editing ? <X size={16} /> : <><FileText size={14} /><span>Խմբագրել</span></>}</button>
              <button className="button button-primary compact-button" onClick={openPrintPreview}><Printer size={14} /></button>
            </>
          )}
          {activeView === 'documents' && <>
            <button className="button button-quiet" onClick={() => fileInputRef.current?.click()} aria-label="Բացել ֆայլ"><Upload size={14} /></button>
            <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.rtf,.png,.jpg,.jpeg" onChange={handleUpload} />
          </>}
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-menu-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex' }}>
          <div style={{ width: '280px', background: '#0b1220', height: '100%', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>Մենյու</span>
              <button className="icon-button" onClick={() => setMenuOpen(false)}><X size={18} /></button>
            </div>
            <button className="nav-item" onClick={() => { setActiveView('home'); setMenuOpen(false) }}><Activity size={16} /> Գլխավոր</button>
            <button className="nav-item" onClick={() => { setActiveView('documents'); setMenuOpen(false); setFileDrawerOpen(true) }}><FileText size={16} /> Փաստաթղթեր ({files.length})</button>
            {activeView !== 'home' && <button className="nav-item" onClick={() => { setCreateModalOpen(true); setMenuOpen(false) }}><FilePlus2 size={16} /> Նոր փաստաթուղթ</button>}
            <button className="nav-item" onClick={() => { setActiveView('security'); setMenuOpen(false) }}><ShieldCheck size={16} /> Անվտանգություն</button>
          </div>
        </div>
      )}

      {message && <div className="notice" style={{ margin: '8px' }}><span>{message}</span><button className="icon-button" onClick={() => setMessage('')}><X size={14} /></button></div>}

      <main style={{ flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '10px 16px', background: '#111b2d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#e2e8f0', fontSize: '13px' }}>{selectedId ? 'Ընթերցող' : 'Ֆայլեր չկան ընտրված'}</span>
              <button className="button button-outline" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => setFileDrawerOpen(true)}>Ցանկ</button>
            </div>
            <div ref={viewerRef} style={{ flex: 1, overflow: 'auto', padding: '12px', background: '#050811' }} className="document-pages" />
          </div>
        )}

        {activeView === 'security' && (
          <div style={{ padding: '16px', color: '#fff' }}>
            <h3>Անվտանգություն</h3>
            <p style={{ color: '#94a3b8', marginTop: '8px' }}>Տվյալները պահվում են սարքի հիշողության մեջ։</p>
          </div>
        )}

        {fileDrawerOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ background: '#0b1220', maxHeight: '80vh', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ color: '#fff', fontSize: '16px' }}>Ֆայլեր ({files.length})</h3>
                <button className="icon-button" onClick={() => setFileDrawerOpen(false)}><X size={18} /></button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {files.filter((file) => fileCategory === 'all' || FILE_CATEGORIES.find((category) => category.id === fileCategory)?.kinds.includes(file.kind)).map((file) => (
                  <button key={file.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#111b2d', border: 0, borderRadius: '8px', color: '#fff', textAlign: 'left' }} onClick={() => { setSelectedId(file.id); setFileDrawerOpen(false); setActiveView('documents') }}>
                    <FileText size={18} color="#90cdf4" />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: '500', fontSize: '13px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{file.name}</div>
                      <small style={{ color: '#94a3b8' }}>{formatBytes(file.size)}</small>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      <CreateDocumentModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onCreate={createDocument}
        title={newDocTitle} setTitle={setNewDocTitle} text={newDocText} setText={setNewDocText}
        paperFormat={newDocFormat} setPaperFormat={setNewDocFormat} outputFormat={newDocOutputFormat} setOutputFormat={setNewDocOutputFormat} paperSizes={PAPER_SIZES} creating={busy} />
    </div>
  )
}
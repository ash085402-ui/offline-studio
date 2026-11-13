import React from 'react'
import {
  Activity, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, EllipsisVertical,
  Cpu, Database, FileSpreadsheet, FileText, HardDrive, LockKeyhole, Menu, Pencil,
  Plus, Printer, Search, ShieldCheck, Sparkles, Upload, X
} from 'lucide-react'

export function MobileStudio({
  files, selectedId, setSelectedId, activeView, setActiveView, search, setSearch,
  busy, message, setMessage, pageCount, editing, toggleEditing, saveEditedCopy,
  openPrintPreview, closeSelectedFile, fileInputRef, handleUpload, viewerRef,
  fileDrawerOpen, setFileDrawerOpen, menuOpen, setMenuOpen, formatBytes,
  FILE_CATEGORIES, openCategories, setOpenCategories, resourceMemory
}) {
  return (
    <div className="mobile-studio-wrapper" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <header className="topbar" style={{ padding: '0 12px', height: '56px' }}>
        <div className="topbar-leading" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Մենյու"><Menu size={20} /></button>
          <span className="topbar-path" style={{ fontSize: '13px' }}><b>MOBILE</b> / {activeView.toUpperCase()}</span>
        </div>
        <div className="topbar-actions">
          {activeView === 'documents' && selectedId && (
            <button className="button button-primary compact-button" onClick={openPrintPreview}><Printer size={14} /></button>
          )}
          <button className="button button-quiet" onClick={() => fileInputRef.current?.click()}><Upload size={14} /></button>
          <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.rtf,.png" onChange={handleUpload} />
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
            <button className="nav-item" onClick={() => { setActiveView('security'); setMenuOpen(false) }}><ShieldCheck size={16} /> Անվտանգություն</button>
          </div>
        </div>
      )}

      {message && <div className="notice" style={{ margin: '8px' }}><span>{message}</span><button className="icon-button" onClick={() => setMessage('')}><X size={14} /></button></div>}

      <main style={{ flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {activeView === 'home' && (
          <div style={{ padding: '16px' }}>
            <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Մոբայլ աշխատատարածք PWA</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>Դիտեք ձեր փաստաթղթերը անմիջապես հեռախոսից։</p>
            <button className="button button-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setActiveView('documents'); setFileDrawerOpen(true) }}>
              Բացել փաստաթղթերը <ArrowRight size={16} />
            </button>
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
                {files.map((file) => (
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
    </div>
  )
}
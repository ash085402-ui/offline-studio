import { useState, useEffect, useRef } from 'react'
import {
  ArrowUpRight, Menu, Printer,
  Sparkles, X, Upload, FileText, Download, Edit3, Database, ShieldCheck
} from 'lucide-react'
import './App.css'
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import * as docxViewer from 'docx-preview';

export default function App() {
  const [activeTab, setActiveTab] = useState('print-tool')
  const [menuOpen, setMenuOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  
  const docContainerRef = useRef(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  // Տեքստային խմբագրիչի վիճակ
  const [editorText, setEditorText] = useState('Այստեղ գրեք կամ խմբագրեք ձեր տեքստը...')

  // Տեղային բազայի և անվտանգության վիճակներ
  const [dbNotes, setDbNotes] = useState([])
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  
  const [pinCode, setPinCode] = useState('')
  const [enteredPin, setEnteredPin] = useState('')
  const [isLocked, setIsLocked] = useState(false)

  const [extraSettings, setExtraSettings] = useState({
    autoSave: true,
    themeMode: 'light',
    notifications: false
  })

  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab')
    if (savedTab) setActiveTab(savedTab)

    const savedFileName = localStorage.getItem('fileName')
    if (savedFileName) setFileName(savedFileName)

    const savedLogin = localStorage.getItem('isLoggedIn') === 'true'
    setIsLoggedIn(savedLogin)

    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)) } catch (e) { console.error(e) }
    }

    const savedEditorText = localStorage.getItem('editorText')
    if (savedEditorText) setEditorText(savedEditorText)

    const savedNotes = localStorage.getItem('offline_db_notes')
    if (savedNotes) {
      try { setDbNotes(JSON.parse(savedNotes)) } catch (e) { console.error(e) }
    }

    const savedPin = localStorage.getItem('app_security_pin')
    if (savedPin) {
      setPinCode(savedPin)
      setIsLocked(true)
    }

    const savedExtra = localStorage.getItem('extra_settings')
    if (savedExtra) {
      try { setExtraSettings(JSON.parse(savedExtra)) } catch (e) { console.error(e) }
    }
  }, [])

  useEffect(() => { localStorage.setItem('activeTab', activeTab) }, [activeTab])
  useEffect(() => { localStorage.setItem('fileName', fileName) }, [fileName])
  useEffect(() => { localStorage.setItem('editorText', editorText) }, [editorText])
  useEffect(() => { localStorage.setItem('offline_db_notes', JSON.stringify(dbNotes)) }, [dbNotes])
  useEffect(() => { localStorage.setItem('extra_settings', JSON.stringify(extraSettings)) }, [extraSettings])

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn)
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('currentUser')
    }
  }, [isLoggedIn, currentUser])

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userData = await res.json();
        const newUser = {
          name: userData.name,
          email: userData.email,
          picture: userData.picture,
          initial: userData.name ? userData.name[0].toUpperCase() : 'U'
        };
        setCurrentUser(newUser);
        setIsLoggedIn(true);
      } catch (err) {
        console.error('Սխալ:', err);
      }
    },
  });

  const handleLogout = () => {
    googleLogout();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setProfileDropdownOpen(false);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
  };

  // Օգտագործում ենք docx-preview գրադարանը Word ֆայլը կարդալու և էջ առ էջ ցուցադրելու համար
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return;

    setFileName(file.name)
    
    if (docContainerRef.current) {
      docContainerRef.current.innerHTML = '<p style="text-align:center; padding: 40px; color: #666;">Բեռնվում և մշակվում է Word ֆայլը...</p>';
      try {
        const arrayBuffer = await file.arrayBuffer();
        await docxViewer.renderAsync(arrayBuffer, docContainerRef.current, null, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          experimental: true,
        });
      } catch (error) {
        console.error('Սխալ docx-preview աշխատանքում:', error);
        docContainerRef.current.innerHTML = '<p style="text-align:center; padding: 40px; color: red;">Չհաջողվեց կարդալ ֆայլը։ Համոզվեք, որ սա վավեր .docx ֆայլ է։</p>';
      }
    }
    setFileInputKey(Date.now());
  }

  const handlePrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 600)
  }

  const handleSaveAsTxt = () => {
    const blob = new Blob([editorText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'document.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddNoteToDb = (e) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;

    const newNote = {
      id: Date.now(),
      title: noteTitle,
      content: noteContent,
      date: new Date().toLocaleDateString()
    };

    setDbNotes([newNote, ...dbNotes]);
    setNoteTitle('');
    setNoteContent('');
  };

  const handleDeleteNote = (id) => {
    setDbNotes(dbNotes.filter(n => n.id !== id));
  };

  const handleSetPin = (e) => {
    e.preventDefault();
    if (enteredPin.length < 4) {
      alert('PIN կոդը պետք է լինի առնվազն 4 նիշ։');
      return;
    }
    localStorage.setItem('app_security_pin', enteredPin);
    setPinCode(enteredPin);
    setIsLocked(false);
    setEnteredPin('');
  };

  const handleUnlock = (e) => {
    e.preventDefault();
    if (enteredPin === pinCode) {
      setIsLocked(false);
      setEnteredPin('');
    } else {
      alert('Սխալ PIN կոդ։');
    }
  };

  const handleRemovePin = () => {
    localStorage.removeItem('app_security_pin');
    setPinCode('');
    setEnteredPin('');
  };

  return (
    <div className="app-shell">
      {isLocked && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '320px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <ShieldCheck size={40} color="#7c3aed" style={{ marginBottom: '12px' }} />
            <h3 style={{ marginBottom: '8px', color: '#1e293b' }}>Հավելվածը կողպված է</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Մուտքագրեք ձեր տեղային PIN կոդը շարունակելու համար:</p>
            <form onSubmit={handleUnlock}>
              <input 
                type="password" 
                maxLength="6"
                placeholder="PIN կոդ..." 
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '16px', textAlign: 'center', letterSpacing: '4px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '16px', outline: 'none' }}
              />
              <button type="submit" style={{ width: '100%', padding: '10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Բացել</button>
            </form>
          </div>
        </div>
      )}

      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div>
          <div className="brand">
            <span className="brand-mark"><Sparkles size={16} /></span>
            <span>OFFLINE<br /><b>STUDIO</b></span>
          </div>
          <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Փակել"><X size={20} /></button>
          
          <nav className="section-nav" aria-label="Նավիգացիա" style={{ marginTop: '24px' }}>
            <a href="#overview" className={activeTab === 'overview' ? 'active-link' : ''} onClick={() => { setActiveTab('overview'); setMenuOpen(false); }}>
              <Sparkles size={16} /> <span>Գլխավոր էջ</span>
            </a>
            <a href="#print-tool" className={activeTab === 'print-tool' ? 'active-link' : ''} onClick={() => { setActiveTab('print-tool'); setMenuOpen(false); }}>
              <Printer size={16} /> <span>Word Էջերի Դիտում և Տպում</span>
            </a>
            <a href="#editor-tool" className={activeTab === 'editor-tool' ? 'active-link' : ''} onClick={() => { setActiveTab('editor-tool'); setMenuOpen(false); }}>
              <Edit3 size={16} /> <span>Տեքստային խմբագրիչ</span>
            </a>
            <a href="#db-security" className={activeTab === 'db-security' ? 'active-link' : ''} onClick={() => { setActiveTab('db-security'); setMenuOpen(false); }}>
              <Database size={16} /> <span>Տեղային Բազա և Անվտանգություն</span>
            </a>
            <a href="#extra-features" className={activeTab === 'extra-features' ? 'active-link' : ''} onClick={() => { setActiveTab('extra-features'); setMenuOpen(false); }}>
              <Sparkles size={16} /> <span>Լրացուցիչ Կարգավորումներ</span>
            </a>
          </nav>
        </div>

        <div className="side-foot">
          <div className="status-dot" />
          <span>Տեղային ռեժիմը ակտիվ է</span>
          <span className="version">v2.1</span>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Բացել"><Menu size={21} /></button>
          <span className="breadcrumb">
            {activeTab === 'overview' ? 'ՆԱԽԱԳԾԻ ՓԱՍՏԱԹՈՒՂՂ' : activeTab === 'print-tool' ? `WORD ՓԱՍՏԱԹՈՒՂԹ (${fileName || 'Ֆայլ ընտրված չէ'})` : activeTab === 'editor-tool' ? 'ՏԵՔՍՏԱՅԻՆ ԽՄԲԱԳՐԻՉ' : activeTab === 'db-security' ? 'ՏԵՂԱՅԻՆ ԲԱԶԱ ԵՎ ԱՆՎՏԱՆԳՈՒԹՅՈՒՆ' : 'ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ'}
          </span>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeTab === 'overview' && (
              !isLoggedIn ? (
                <button className="outline-button" onClick={() => googleLogin()}>Մուտք Google-ով</button>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div onClick={() => setProfileDropdownOpen(!profileDropdownOpen)} style={{ cursor: 'pointer' }}>
                    {currentUser?.picture ? (
                      <img src={currentUser.picture} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {currentUser?.initial}
                      </div>
                    )}
                  </div>
                  {profileDropdownOpen && (
                    <div style={{ position: 'absolute', right: 0, top: '44px', width: '200px', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #eaeaea', padding: '8px 0', zIndex: 1000 }}>
                      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', margin: 0 }}>{currentUser?.name}</p>
                      </div>
                      <button onClick={handleLogout} style={{ width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', color: '#dc2626', fontSize: '13px', cursor: 'pointer' }}>Դուրս գալ</button>
                    </div>
                  )}
                </div>
              )
            )}
            {activeTab === 'print-tool' && (
              <>
                <label className="primary-button" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'var(--accent)', color: '#fff', borderRadius: '6px', fontSize: '13px' }}>
                  <Upload size={14} /> Բացել Word ֆայլը (.docx)
                  <input key={fileInputKey} type="file" accept=".docx" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>

                <button onClick={handlePrint} className="primary-button" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#111', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
                  <Printer size={14} /> {isPrinting ? 'Նախապատրաստում...' : 'Տպել / PDF'}
                </button>
              </>
            )}
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="fade-in">
            <section id="overview" className="hero-section">
              <div className="hero-copy">
                <span className="eyebrow accent">ՀԱՄԱԼՍԱՐԱՆԱԿԱՆ ՆԱԽԱԳԻԾ</span>
                <h1>Word փաստաթղթերի <em>էջ առ էջ</em><br />դիտման համակարգ</h1>
                <button className="primary-button" onClick={() => setActiveTab('print-tool')}>
                  Բացել Word դիտման վահանակը <ArrowUpRight size={17} />
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'print-tool' && (
          <section id="print-tool" className="print-workspace fade-in">
            <div ref={docContainerRef} className="docx-pages-container">
              <div className="empty-doc-page">
                <p>Բեռնեք <b>.docx</b> ֆայլ՝ այն Word-ի նման առանձին A4 էջերով իրար տակ տեսնելու համար։</p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'editor-tool' && (
          <section id="editor-tool" className="fade-in" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', background: '#f8fafc', minHeight: 'calc(100vh - 70px)', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', maxWidth: '800px', background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '12px', color: '#1e293b' }}>Տեքստային փաստաթղթի ստեղծում</h2>
              <textarea 
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                style={{ width: '100%', height: '350px', padding: '16px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button onClick={handleSaveAsTxt} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                  <Download size={15} /> Պահպանել որպես .txt
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'db-security' && (
          <section id="db-security" className="fade-in" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', background: '#f8fafc', minHeight: 'calc(100vh - 70px)', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={20} color="#0284c7" /> Տեղային տվյալների բազա
                </h2>
                <form onSubmit={handleAddNoteToDb} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <input type="text" placeholder="Վերնագիր..." value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <textarea placeholder="Բովանդակություն..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '80px' }} />
                  <button type="submit" style={{ alignSelf: 'flex-start', padding: '8px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Ավելացնել</button>
                </form>
                <div>
                  {dbNotes.map((note) => (
                    <div key={note.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '10px 14px', borderRadius: '6px', marginBottom: '8px' }}>
                      <div><h5>{note.title}</h5><p style={{ fontSize: '12px', color: '#64748b' }}>{note.content}</p></div>
                      <button onClick={() => handleDeleteNote(note.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Ջնջել</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} color="#16a34a" /> Տեղային անվտանգություն (PIN)
                </h2>
                {!pinCode ? (
                  <form onSubmit={handleSetPin} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input type="password" maxLength="6" placeholder="PIN..." value={enteredPin} onChange={(e) => setEnteredPin(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ padding: '10px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Սահմանել PIN</button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', padding: '12px 16px', borderRadius: '6px' }}>
                    <span>🔒 PIN կոդը ակտիվ է</span>
                    <button onClick={handleRemovePin} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Անջատել</button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'extra-features' && (
          <section id="extra-features" className="fade-in" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', background: '#f8fafc', minHeight: 'calc(100vh - 70px)', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', maxWidth: '800px', background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="#7c3aed" /> Լրացուցիչ կարգավորումներ
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={extraSettings.autoSave} onChange={(e) => setExtraSettings({...extraSettings, autoSave: e.target.checked})} />
                  Ավտոմատ պահպանում
                </label>
              </div>
            </div>
          </section>
        )}

        <style>{`
          .docx-pages-container {
            background: #cbd5e1 !important;
            width: 100% !important;
            min-height: calc(100vh - 70px) !important;
            padding: 40px 0 60px !important;
            box-sizing: border-box !important;
            overflow-x: auto !important;
          }

          /* Չենք փոխում docx-preview-ի կողմից հաշվարկված էջի width/height-ը։
             Այդ չափերը գալիս են հենց Word ֆայլի section/page settings-ից։ */
          .docx-pages-container .docx-wrapper {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: max-content !important;
            min-width: 100% !important;
          }

          .docx-pages-container .docx-wrapper > section.docx {
            margin: 0 auto 28px !important;
            background: #fff !important;
            box-shadow: 0 3px 16px rgba(0, 0, 0, 0.18) !important;
            box-sizing: border-box !important;
            position: relative !important;
          }

          .docx-pages-container .docx-wrapper > section.docx:last-child {
            margin-bottom: 0 !important;
          }

          /* Պարբերությունը չկիսել երկու էջերի միջև, երբ հնարավոր է։ */
          .docx-pages-container .docx-wrapper > section.docx p,
          .docx-pages-container .docx-wrapper > section.docx li,
          .docx-pages-container .docx-wrapper > section.docx table,
          .docx-pages-container .docx-wrapper > section.docx tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Երկար պարբերությունը, որը ֆիզիկապես չի տեղավորվում մեկ էջում,
             պետք է կարողանա շարունակվել հաջորդ էջում։ */
          .docx-pages-container .docx-wrapper > section.docx p {
            orphans: 2;
            widows: 2;
          }

          @media screen and (max-width: 900px) {
            .docx-pages-container {
              padding-left: 12px !important;
              padding-right: 12px !important;
            }

            .docx-pages-container .docx-wrapper {
              width: max-content !important;
              min-width: 0 !important;
              transform-origin: top center;
            }
          }

          @media print {
            @page {
              size: A4 portrait;
              margin: 0;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
            }

            .sidebar,
            .topbar,
            button,
            label {
              display: none !important;
            }

            .content {
              margin: 0 !important;
              padding: 0 !important;
            }

            .print-workspace,
            .docx-pages-container {
              padding: 0 !important;
              margin: 0 !important;
              background: #fff !important;
              overflow: visible !important;
            }

            .docx-pages-container .docx-wrapper {
              width: auto !important;
              min-width: 0 !important;
              margin: 0 !important;
            }

            .docx-pages-container .docx-wrapper > section.docx {
              margin: 0 !important;
              box-shadow: none !important;
              break-after: page !important;
              page-break-after: always !important;
            }

            .docx-pages-container .docx-wrapper > section.docx:last-child {
              break-after: auto !important;
              page-break-after: auto !important;
            }
          }
        `}</style>
      </main>
    </div>
  )
}
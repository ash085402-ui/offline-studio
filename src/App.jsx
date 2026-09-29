import { useState, useEffect, useRef } from 'react'
import {
  ArrowUpRight, Menu, Printer,
  Sparkles, X, Upload, FileText, Download, Edit3, Database, ShieldCheck
} from 'lucide-react'
import './App.css'
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import * as docx from 'docx-preview';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  
  const docContainerRef = useRef(null)
  const allPagesRef = useRef([])

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [isPrinting, setIsPrinting] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  // Տեքստային խմբագրիչի վիճակ
  const [editorText, setEditorText] = useState('Այստեղ գրեք կամ խմբագրեք ձեր տեքստը Ռազմիկի պահանջներին համապատասխան...')

  // Տեղային բազայի և անվտանգության վիճակներ
  const [dbNotes, setDbNotes] = useState([])
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  
  const [pinCode, setPinCode] = useState('')
  const [enteredPin, setEnteredPin] = useState('')
  const [isLocked, setIsLocked] = useState(false)

  // Տվյալների անվտանգ բեռնում localStorage-ից միայն բրաուզերում
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab')
    if (savedTab) setActiveTab(savedTab)

    const savedFileName = localStorage.getItem('fileName')
    if (savedFileName) setFileName(savedFileName)

    const savedLogin = localStorage.getItem('isLoggedIn') === 'true'
    setIsLoggedIn(savedLogin)

    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser))
      } catch (e) {
        console.error(e)
      }
    }

    const savedEditorText = localStorage.getItem('editorText')
    if (savedEditorText) setEditorText(savedEditorText)

    const savedNotes = localStorage.getItem('offline_db_notes')
    if (savedNotes) {
      try {
        setDbNotes(JSON.parse(savedNotes))
      } catch (e) {
        console.error(e)
      }
    }

    const savedPin = localStorage.getItem('app_security_pin')
    if (savedPin) {
      setPinCode(savedPin)
      setIsLocked(true)
    }
  }, [])

  useEffect(() => { localStorage.setItem('activeTab', activeTab) }, [activeTab])
  useEffect(() => { localStorage.setItem('fileName', fileName) }, [fileName])
  useEffect(() => { localStorage.setItem('editorText', editorText) }, [editorText])
  useEffect(() => { localStorage.setItem('offline_db_notes', JSON.stringify(dbNotes)) }, [dbNotes])

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

  const renderDocx = async (arrayBuffer) => {
    if (!docContainerRef.current) return;
    
    try {
      const tempContainer = document.createElement('div');
      
      await docx.renderAsync(arrayBuffer, tempContainer, null, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        experimental: true,
      });

      let pages = Array.from(tempContainer.querySelectorAll('.docx-page'));
      
      if (pages.length === 0) {
        pages = Array.from(tempContainer.querySelectorAll('section'));
      }
      
      if (pages.length === 0) {
        const wrapper = tempContainer.querySelector('.docx-wrapper') || tempContainer;
        pages = Array.from(wrapper.children);
      }

      if (pages.length > 0) {
        allPagesRef.current = pages;
        setTotalPages(pages.length);
        setCurrentPage(1);
        displayPage(1, pages);
      }
    } catch (error) {
      console.error('Սխալ docx-ի վիզուալիզացիայի ժամանակ:', error);
      if (docContainerRef.current) {
        docContainerRef.current.innerHTML = '<p style="color: red; padding: 20px;">Չհաջողվեց բացել ֆայլը docx-preview շարժիչով։</p>';
      }
    }
  };

  const displayPage = (pageNum, pages = allPagesRef.current) => {
    if (!docContainerRef.current) return;
    docContainerRef.current.innerHTML = '';
    
    const targetPage = pages[pageNum - 1];
    if (targetPage) {
      const clone = targetPage.cloneNode(true);
      clone.style.display = 'block';
      clone.style.width = '794px';
      clone.style.minHeight = '1123px';
      clone.style.margin = '0 auto';
      clone.style.background = '#ffffff';
      clone.style.boxSizing = 'border-box';
      docContainerRef.current.appendChild(clone);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      displayPage(newPage);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return;

    setFileName(file.name)
    const reader = new FileReader()
    
    if (file.name.endsWith('.docx') || file.name.endsWith('.DOCX')) {
      reader.onload = async (event) => {
        const arrayBuffer = event.target.result;
        renderDocx(arrayBuffer);
        setFileInputKey(Date.now());
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (event) => {
        const text = event.target.result ? event.target.result : 'Ֆայլը դատարկ է';
        if (docContainerRef.current) {
          const p = document.createElement('div');
          p.className = 'docx-page';
          p.innerHTML = `<p>${text.replace(/\n/g, '</p><p>')}</p>`;
          allPagesRef.current = [p];
          setTotalPages(1);
          setCurrentPage(1);
          displayPage(1, [p]);
        }
        setFileInputKey(Date.now());
      }
      reader.readAsText(file, 'UTF-8')
    }
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

  const handleExportPdf = () => {
    window.print();
  };

  // Տեղային բազային նոր գրառման ավելացում
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

  // Գրառման ջնջում բազայից
  const handleDeleteNote = (id) => {
    setDbNotes(dbNotes.filter(n => n.id !== id));
  };

  // PIN կոդի ստեղծում / փفلում
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
      {/* Անվտանգության կողպեքի էկրան */}
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
              <Printer size={16} /> <span>Դիտում և Տպագրություն</span>
            </a>
            <a href="#editor-tool" className={activeTab === 'editor-tool' ? 'active-link' : ''} onClick={() => { setActiveTab('editor-tool'); setMenuOpen(false); }}>
              <Edit3 size={16} /> <span>Տեքստային խմբագրիչ</span>
            </a>
            <a href="#db-security" className={activeTab === 'db-security' ? 'active-link' : ''} onClick={() => { setActiveTab('db-security'); setMenuOpen(false); }}>
              <Database size={16} /> <span>Տեղային Բազա և Անվտանգություն</span>
            </a>
          </nav>
        </div>

        <div className="side-foot">
          <div className="status-dot" />
          <span>Տեղային ռեժիմը ակտիվ է</span>
          <span className="version">v1.8</span>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Բացել"><Menu size={21} /></button>
          <span className="breadcrumb">
            {activeTab === 'overview' ? 'ՆԱԽԱԳԾԻ ՓԱՍՏԱԹՈՒՂՂ ' : activeTab === 'print-tool' ? `ՏՊԱԳՐՄԱՆ ՎԱՀԱՆԱԿ (${fileName || 'Ֆայլ ընտրված չէ'})` : activeTab === 'editor-tool' ? 'ՏԵՔՍՏԱՅԻՆ ԽՄԲԱԳՐԻՉ ԵՎ PDF' : 'ՏԵՂԱՅԻՆ ԲԱԶԱ ԵՎ ԱՆՎՏԱՆԳՈՒԹՅՈՒՆ'}
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
                  <Upload size={14} /> Բացել ֆայլը (.docx)
                  <input key={fileInputKey} type="file" accept=".docx, .txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>

                <button onClick={handlePrint} className="primary-button" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#111', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
                  <Printer size={14} /> {isPrinting ? 'Նախապատրաստում...' : 'Տպել հիմա'}
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
                <h1>Մուլտիմեդիա և փաստաթղթերի<br /><em>ինքնավար</em> մշակման համակարգ</h1>
                <button className="primary-button" onClick={() => setActiveTab('print-tool')}>
                  Բացել տպագրության վահանակը <ArrowUpRight size={17} />
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'print-tool' && (
          <section id="print-tool" className="print-workspace fade-in" style={{ padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', background: '#cbd5e1', minHeight: 'calc(100vh - 70px)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', background: '#ffffff', padding: '6px 16px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <button 
                onClick={() => handlePageChange(currentPage - 1)} 
                disabled={currentPage <= 1}
                style={{ background: '#f1f5f9', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                &lt;
              </button>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
                Էջ {currentPage} / {totalPages}
              </span>
              <button 
                onClick={() => handlePageChange(currentPage + 1)} 
                disabled={currentPage >= totalPages}
                style={{ background: '#f1f5f9', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                &gt;
              </button>
            </div>

            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              <div ref={docContainerRef} className="docx-viewer-container" style={{ width: '794px' }}>
                <div style={{ background: '#fff', padding: '60px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center', width: '794px', margin: '0 auto' }}>
                  <p style={{ color: '#555', fontSize: '15px' }}>Ընտրեք <b>.docx</b> ֆայլ՝ էջ առ էջ A4 ձևաչափով դիտելու համար։</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'editor-tool' && (
          <section id="editor-tool" className="fade-in" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', background: '#f8fafc', minHeight: 'calc(100vh - 70px)', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', maxWidth: '800px', background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '12px', color: '#1e293b' }}>Տեքստային փաստաթղթի ստեղծում և խմբագրում</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                Այս բաժինը թույլ է տալիս տեղային ռեժիմով խմբագրել տեքստը, պահպանել այն որպես ֆայլ կամ արտահանել PDF ձևաչափով՝ առանց ամպային սերվերների:
              </p>
              
              <textarea 
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                style={{
                  width: '100%',
                  height: '350px',
                  padding: '16px',
                  fontSize: '14px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button 
                  onClick={handleSaveAsTxt}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                >
                  <Download size={15} /> Պահպանել որպես .txt
                </button>
                <button 
                  onClick={handleExportPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                >
                  <FileText size={15} /> Արտահանել PDF
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'db-security' && (
          <section id="db-security" className="fade-in" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', background: '#f8fafc', minHeight: 'calc(100vh - 70px)', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Տեղային Բազայի բաժին */}
              <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={20} color="#0284c7" /> Տեղային տվյալների բազա (SQLite / Local Storage)
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  Կառավարեք ձեր գրառումները սարքի տեղային հիշողության մեջ առանց արտաքին սերվերների:
                </p>

                <form onSubmit={handleAddNoteToDb} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <input 
                    type="text" 
                    placeholder="Գրառման վերնագիր..." 
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                  />
                  <textarea 
                    placeholder="Գրառման բովանդակություն..." 
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', height: '80px', outline: 'none', resize: 'vertical' }}
                  />
                  <button type="submit" style={{ alignSelf: 'flex-start', padding: '8px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', fontSize: '13px' }}>
                    Ավելացնել բազայում
                  </button>
                </form>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '12px', color: '#334155' }}>Պահպանված գրառումներ ({dbNotes.length})</h4>
                  {dbNotes.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>Բազան դատարկ է։</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                      {dbNotes.map((note) => (
                        <div key={note.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '10px 14px', borderRadius: '6px' }}>
                          <div>
                            <h5 style={{ fontSize: '14px', margin: 0, color: '#1e293b' }}>{note.title}</h5>
                            <p style={{ fontSize: '12px', margin: '4px 0 0', color: '#64748b' }}>{note.content} <span style={{ fontSize: '10px', color: '#94a3b8' }}>({note.date})</span></p>
                          </div>
                          <button onClick={() => handleDeleteNote(note.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Ջնջել</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Անվտանգության և PIN կոդի բաժին */}
              <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} color="#16a34a" /> Տեղային անվտանգություն (PIN Կոդ)
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  Պաշտպանեք ձեր տեղային ֆայլերն ու տվյալները PIN կոդով։
                </p>

                {!pinCode ? (
                  <form onSubmit={handleSetPin} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input 
                      type="password" 
                      maxLength="6"
                      placeholder="Մուտքագրեք նոր PIN..." 
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value)}
                      style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', width: '200px' }}
                    />
                    <button type="submit" style={{ padding: '10px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', fontSize: '13px' }}>
                      Սահմանել PIN
                    </button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', padding: '12px 16px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '13px', color: '#166534', fontWeight: '500' }}>🔒 PIN կոդը հաջողությամբ ակտիվացված է</span>
                    <button onClick={handleRemovePin} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                      Անջատել PIN-ը
                    </button>
                  </div>
                )}
              </div>

            </div>
          </section>
        )}

        <style>{`
          .docx-viewer-container .docx-page,
          .docx-viewer-container section {
            background: #ffffff !important;
            width: 794px !important;
            min-height: 1123px !important;
            max-height: 1123px !important;
            overflow: hidden !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15) !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            border-radius: 2px !important;
            padding: 50px 65px !important;
          }

          @media print {
            body { background: #fff !important; }
            .sidebar, .topbar, div[style*="display: flex; align-items: center; gap: 12px; margin-bottom: 20px"], button { display: none !important; }
            .print-workspace, #editor-tool, #db-security { padding: 0 !important; background: #fff !important; }
            #editor-tool textarea, #db-security input, #db-security textarea { border: none !important; resize: none !important; }
            .docx-viewer-container .docx-page,
            .docx-viewer-container section {
              box-shadow: none !important;
              margin: 0 !important;
              width: 100% !important;
              min-height: 100vh !important;
              max-height: none !important;
              overflow: visible !important;
              page-break-after: always !important;
              break-after: page !important;
            }
          }
        `}</style>
      </main>
    </div>
  )
}

import { useState, useEffect } from 'react'
import {
  ArrowUpRight, Database, FileText,
  Fingerprint, LockKeyhole, Menu, Printer,
  Smartphone, Sparkles, X, Upload
} from 'lucide-react'
import './App.css'
import { useGoogleLogin, googleLogout } from '@react-oauth/google';

export default function App() {
  // localStorage-ից վերցնում ենք պահպանված ակտիվ թաբը կամ դնում 'overview'
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'overview'
  })
  
  const [menuOpen, setMenuOpen] = useState(false)
  
  const [fileName, setFileName] = useState(() => {
    return localStorage.getItem('fileName') || ''
  })
  const [fileContent, setFileContent] = useState(() => {
    return localStorage.getItem('fileContent') || 'Այս փաստաթուղթը պատրաստ է տպագրության։ Այն ցուցադրվում է էկրանին որպես թուղթ, որից հետո կարող եք անմիջապես ուղղել տպիչին։'
  })
  const [isPrinting, setIsPrinting] = useState(false)

  // Օգտատիրոջ վիճակը (localStorage-ում պահպանելով, որ էջը թարմացնելիս չկորչի)
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true'
  })
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser')
    return savedUser ? JSON.parse(savedUser) : null
  })
  
  // Պրոֆիլի Dropdown մենյուի վիճակը
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  // Տվյալների պահպանում localStorage-ում փոփոխվելիս
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  useEffect(() => {
    localStorage.setItem('fileName', fileName)
  }, [fileName])

  useEffect(() => {
    localStorage.setItem('fileContent', fileContent)
  }, [fileContent])

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn)
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('currentUser')
    }
  }, [isLoggedIn, currentUser])

  // Իրական Google OAuth Popup Մուտքը
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log('Հաջողված մուտք:', tokenResponse);
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userData = await res.json();
        console.log('Օգտատեր:', userData);
        
        const userObj = {
          name: userData.name,
          email: userData.email,
          picture: userData.picture,
          initial: userData.name ? userData.name[0].toUpperCase() : 'U'
        };

        setCurrentUser(userObj);
        setIsLoggedIn(true);
      } catch (err) {
        console.error('Սխալ օգտատիրոջ տվյալները ստանալիս:', err);
      }
    },
    onError: (error) => {
      console.log('Մուտքը ձախողվեց:', error);
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

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFileName(file.name)
      const reader = new FileReader()
      
      // Եթե ֆայլը docx է կամ տեքստային
      if (file.name.endsWith('.docx')) {
        setFileContent(`[Word Փաստաթուղթ՝ ${file.name}]\n\nՓաստաթուղթը հաջողությամբ բեռնված է և պատրաստ է Ա4 ձևաչափով էկրանային նախադիտման ու տպագրության։\nՖայլի չափը՝ ${Math.round(file.size / 1024)} KB`)
      } else {
        reader.onload = (event) => {
          setFileContent(event.target.result)
        }
        if (file.type.includes('text') || file.name.endsWith('.txt')) {
          reader.readAsText(file)
        } else {
          setFileContent(`Բեռնված ֆայլ՝ ${file.name} (${Math.round(file.size / 1024)} KB)\nՁևաչափը պատրաստ է էկրանային նախադիտման և տպագրության։`)
        }
      }
    }
  }

  const handlePrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 600)
  }

  return (
    <div className="app-shell">
      {/* Ձախ Մենյու */}
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div>
          <div className="brand">
            <span className="brand-mark"><Sparkles size={16} /></span>
            <span>OFFLINE<br /><b>STUDIO</b></span>
          </div>
          <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Փակել ընտրացանկը"><X size={20} /></button>
          
          <nav className="section-nav" aria-label="Նավիգացիա" style={{ marginTop: '24px' }}>
            <a 
              href="#overview" 
              className={activeTab === 'overview' ? 'active-link' : ''}
              onClick={() => { setActiveTab('overview'); setMenuOpen(false); }}
            >
              <span className="nav-index"></span>
              <Sparkles size={16} />
              <span>Գլխավոր էջ</span>
            </a>

            <a 
              href="#print-tool" 
              className={activeTab === 'print-tool' ? 'active-link' : ''}
              onClick={() => { setActiveTab('print-tool'); setMenuOpen(false); }}
            >
              <span className="nav-index"></span>
              <Printer size={16} />
              <span>Տպագրություն</span>
            </a>
          </nav>
        </div>

        <div className="side-foot">
          <div className="status-dot" />
          <span>Տեղային ռեժիմը ակտիվ է</span>
          <span className="version">v1.0</span>
        </div>
      </aside>

      {/* Հիմնական բովանդակություն */}
      <main className="content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Բացել ընտրացանկը"><Menu size={21} /></button>
          <span className="breadcrumb">
            {activeTab === 'overview' ? 'ՆԱԽԱԳԾԻ ՓԱՍՏԱԹՈՒՂԹ ' : 'ՏՊԱԳՐՄԱՆ ՎԱՀԱՆԱԿ'}
          </span>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeTab === 'overview' ? (
              !isLoggedIn ? (
                <button 
                  className="outline-button" 
                  onClick={() => googleLogin()}
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}
                >
                  Մուտք Google-ով
                </button>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div 
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    title={currentUser?.email} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    {currentUser?.picture ? (
                      <img src={currentUser.picture} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                    ) : (
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#7c3aed',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        {currentUser?.initial}
                      </div>
                    )}
                  </div>

                  {/* Dropdown Մենյու */}
                  {profileDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '44px',
                      width: '200px',
                      background: '#fff',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      border: '1px solid #eaeaea',
                      padding: '8px 0',
                      zIndex: 1000
                    }}>
                      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#111', margin: 0 }}>{currentUser?.name}</p>
                        <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 16px',
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: '13px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        Դուրս գալ (Logout)
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <>
                <label className="primary-button" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'var(--accent)', color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
                  <Upload size={14} /> Բացել ֆայլը (.docx)
                  <input type="file" accept=".docx, .txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>

                <button 
                  onClick={handlePrint} 
                  className="primary-button" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#111', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                >
                  <Printer size={14} /> {isPrinting ? 'Նախապատրաստում...' : 'Տպել հիմա'}
                </button>
              </>
            )}
          </div>
        </header>

        {/* ԲԱԺԻՆ 1: ԳԼԽԱՎՈՐ ԷՋ */}
        {activeTab === 'overview' && (
          <div className="fade-in" style={{ animation: 'fadeIn 0.4s ease-in-out' }}>
            <section id="overview" className="hero-section">
              <div className="hero-copy">
                <span className="eyebrow accent">ՀԱՄԱԼՍԱՐԱՆԱԿԱՆ ՆԱԽԱԳԻԾ · ԹԵՄԱ 01—02</span>
                <h1>Մուլտիմեդիա ֆայլերի<br /><em>ինքնավար</em> մշակման<br />մոբայլ էկոհամակարգ</h1>
                <p className="hero-lead">Առանց համակարգչի և արտաքին ամպային ծառայությունների՝ տարբեր ֆայլերի ստեղծում, խմբագրում, փոխարկում և տպում՝ անմիջապես սմարթֆոնից։</p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => setActiveTab('print-tool')} style={{ border: 'none', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
                    Բացել տպագրության վահանակը <ArrowUpRight size={17} />
                  </button>
                  <span className="meta-note"><LockKeyhole size={15} /> Տվյալները չեն լքում սարքը</span>
                </div>
              </div>
              <div className="hero-art">
                <div className="orbit orbit-one" /><div className="orbit orbit-two" />
                <div className="device-card">
                  <div className="device-top"><span>LOCAL CORE</span><span className="device-signal"><i /> SECURE</span></div>
                  <div className="device-icon"><Smartphone size={32} strokeWidth={1.4} /></div>
                  <strong>100%</strong><small>սարքի ռեսուրսների վրա</small>
                  <div className="device-lines"><span /><span /><span /></div>
                </div>
                <div className="floating-chip chip-lock"><Fingerprint size={17} /><span>Biometric<br /><b>enabled</b></span></div>
                <div className="floating-chip chip-db"><Database size={17} /><span>SQLite<br /><b>local only</b></span></div>
              </div>
            </section>
          </div>
        )}

        {/* ԲԱԺԻՆ 2: ՏՊԱԳՐՈՒԹՅԱՆ ՎԱՀԱՆԱԿ (Ա4 ԹՂԹԻ ՁԵՎԱՉԱՓՈՎ) */}
        {activeTab === 'print-tool' && (
          <section id="print-tool" className="print-workspace fade-in" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '100%', animation: 'fadeIn 0.4s ease-in-out', background: '#f0f2f5', minHeight: 'calc(100vh - 70px)' }}>
            
            {/* Ա4 ԹՂԹԻ ՎԻԶՈՒԱԼ ՎԱՀԱՆԱԿ */}
            <div style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '794px',
              minHeight: '1123px',
              padding: '60px 50px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              borderRadius: '4px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              position: 'relative'
            }}>
              {/* Ֆայլի վերնագիրը թղթի վրա */}
              <div style={{ borderBottom: '2px solid #333', paddingBottom: '12px', marginBottom: '24px' }}>
                <span style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Փաստաթղթի նախադիտում (A4)</span>
                <h2 style={{ fontSize: '20px', color: '#111', margin: '4px 0 0 0', wordBreak: 'break-all' }}>
                  {fileName || 'Ֆայլ ընտրված չէ'}
                </h2>
              </div>

              {/* Թղթի բովանդակությունը */}
              <div style={{ color: '#222', fontSize: '15px', lineHeight: '1.8', whiteSpace: 'pre-wrap', fontFamily: 'Times New Roman, serif' }}>
                {fileContent}
              </div>

              {/* Ստորին նշում թղթի վրա */}
              <div style={{ position: 'absolute', bottom: '30px', left: '50px', right: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                <span>OFFLINE STUDIO - Տեղային տպագրության համակարգ</span>
                <span>Էջ 1 / 1</span>
              </div>
            </div>

          </section>
        )}

        <footer className="footer" style={{ marginTop: 'auto' }}>
          <span></span>
          <span><b></b></span>
        </footer>
      </main>
    </div>
  )
}
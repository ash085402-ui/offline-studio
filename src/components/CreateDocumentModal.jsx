import { ChevronDown, FilePlus2, X } from 'lucide-react'

export function CreateDocumentModal({
  open, onClose, onCreate, title, setTitle, text, setText, paperFormat, setPaperFormat,
  outputFormat, setOutputFormat, paperSizes, creating,
}) {
  if (!open) return null

  return (
    <div className="create-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="create-modal" onSubmit={onCreate}>
        <header className="create-modal-header">
          <div className="create-modal-icon"><FilePlus2 size={19} /></div>
          <div><p className="eyebrow">ՆՈՐ ՓԱՍՏԱԹՈՒՂԹ</p><h2>Ստեղծել փաստաթուղթ</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Փակել"><X size={18} /></button>
        </header>
        <label className="create-field">
          Անվանում
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Օրինակ՝ Հանդիպման նշումներ" />
        </label>
        <label className="create-field">
          Բովանդակություն
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Գրեք փաստաթղթի բովանդակությունը…" />
        </label>
        <div className="create-options">
          <label className="create-field">
            Թղթի ձևաչափ
            <select value={paperFormat} onChange={(event) => setPaperFormat(event.target.value)}>
              {Object.values(paperSizes).map((size) => <option key={size.label} value={size.label}>{size.label}</option>)}
            </select>
          </label>
          <div className="create-paper-note">Ուղղահայաց էջ · չափը կկիրառվի ստեղծելիս</div>
        </div>
        <footer className="create-modal-actions">
          <label className="output-format-select">
            <span className="visually-hidden">Ֆայլի ձևաչափ</span>
            <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)}>
              <option value="docx">DOCX</option>
              <option value="pdf">PDF</option>
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
              <option value="txt">TXT</option>
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
          <button className="button button-primary" type="submit" disabled={creating}><FilePlus2 size={15} /> {creating ? 'Ստեղծվում է…' : 'Ստեղծել'}</button>
        </footer>
      </form>
    </div>
  )
}
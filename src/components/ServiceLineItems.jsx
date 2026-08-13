import { SERVICE_OPTIONS, emptyServiceLine } from '../lib/services'

export default function ServiceLineItems({ lines, onChange }) {
  function updateLine(id, patch) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function addLine() {
    onChange([...lines, emptyServiceLine()])
  }

  function removeLine(id) {
    onChange(lines.filter((l) => l.id !== id))
  }

  return (
    <div className="service-lines">
      {lines.map((line) => (
        <div className="service-line" key={line.id}>
          <select
            value={line.type}
            onChange={(e) => updateLine(line.id, { type: e.target.value })}
          >
            {SERVICE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {line.type === 'Custom' && (
            <input
              placeholder="Custom service name"
              value={line.customName}
              onChange={(e) => updateLine(line.id, { customName: e.target.value })}
            />
          )}
          <input
            type="number"
            step="0.01"
            placeholder="Price ($)"
            value={line.price}
            onChange={(e) => updateLine(line.id, { price: e.target.value })}
          />
          {lines.length > 1 && (
            <button type="button" className="btn-secondary service-line-remove" onClick={() => removeLine(line.id)}>
              Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={addLine}>+ Add Service</button>
    </div>
  )
}

interface Props {
  hint?: string
  dirty: boolean
  busy?: boolean
  saved?: boolean
  error?: string
  className?: string
  onSave: () => void
  onCancel: () => void
}

export function SettingsCommitBar({
  hint,
  dirty,
  busy = false,
  saved = false,
  error = '',
  className = '',
  onSave,
  onCancel,
}: Props) {
  return (
    <div className={`settings-commit ${className}`.trim()}>
      {hint && <p className="account-hint">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
      {saved && !dirty && !error && <p className="auth-info">Saved.</p>}
      <div className="settings-commit-actions">
        <button
          type="button"
          className="btn primary small"
          disabled={!dirty || busy}
          onClick={onSave}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          className="btn ghost small"
          disabled={!dirty || busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

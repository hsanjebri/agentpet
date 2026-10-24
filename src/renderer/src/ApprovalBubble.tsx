import type { PermissionDecision, PermissionPrompt } from '@shared/events'

interface Props {
  prompt: PermissionPrompt
  /** how many more are waiting after this one */
  more: number
  onDecide(decision: PermissionDecision): void
}

function projectName(cwd?: string): string | undefined {
  return cwd?.split(/[\\/]/).filter(Boolean).pop()
}

/** Speech bubble above the pet: what the agent wants to do, with Approve / Deny. */
export function ApprovalBubble({ prompt, more, onDecide }: Props): React.JSX.Element {
  const project = projectName(prompt.cwd)

  return (
    <div className="bubble" data-ui="">
      <div className="bubble-title">
        {project ? `${project} · ` : ''}wants to use <b>{prompt.toolName}</b>
        {more > 0 && <span className="bubble-more">+{more}</span>}
      </div>
      {prompt.target && (
        <code className="bubble-target" title={prompt.target}>
          {prompt.target}
        </code>
      )}
      <div className="bubble-actions">
        <button className="btn btn-approve" onClick={() => onDecide('allow')}>
          Approve
        </button>
        <button className="btn btn-deny" onClick={() => onDecide('deny')}>
          Deny
        </button>
        <button
          className="btn btn-terminal"
          title="Answer in the terminal instead"
          onClick={() => onDecide('terminal')}
        >
          ⌨
        </button>
      </div>
    </div>
  )
}

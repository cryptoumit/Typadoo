import React from 'react';
import type { Snippet, SnippetGroup } from '../types';

interface SnippetCardProps {
  snippet: Snippet;
  group?: SnippetGroup;
  onCopy: (snippet: Snippet) => void;
  onDuplicate: (snippet: Snippet) => void;
  onEdit: (snippet: Snippet) => void;
  onDelete: (snippet: Snippet) => void;
  onToggleFavorite: (snippet: Snippet) => void;
  onToggleEnabled: (snippet: Snippet) => void;
}

export function SnippetCard({
  snippet,
  group,
  onCopy,
  onDuplicate,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleEnabled,
}: SnippetCardProps) {
  return (
    <article className={`snippet-card${snippet.status === 'disabled' ? ' is-disabled' : ''}`}>
      <div className="snippet-card-top">
        <div className="snippet-heading">
          <h3>{snippet.title}</h3>
          <code className="shortcut-chip">{snippet.shortcut}</code>
        </div>
        <button
          className={`favorite-button${snippet.favorite ? ' is-favorite' : ''}`}
          type="button"
          onClick={() => onToggleFavorite(snippet)}
          aria-label={
            snippet.favorite
              ? `Remove ${snippet.title} from favorites`
              : `Add ${snippet.title} to favorites`
          }
          aria-pressed={snippet.favorite}
        >
          {snippet.favorite ? '★' : '☆'}
        </button>
      </div>

      <p className="snippet-preview">{snippet.content}</p>

      <div className="snippet-meta">
        <span className="group-badge">{group?.name ?? 'Unknown group'}</span>
        <span
          className={`status-badge ${snippet.status === 'enabled' ? 'status-enabled' : 'status-disabled'}`}
        >
          {snippet.status === 'enabled' ? 'Enabled' : 'Disabled'}
        </span>
        {snippet.tags.map((tag) => (
          <span className="tag-badge" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <div className="snippet-actions">
        <button
          className="button button-small button-secondary"
          type="button"
          onClick={() => onCopy(snippet)}
        >
          Copy
        </button>
        <button
          className="button button-small button-quiet"
          type="button"
          onClick={() => onToggleEnabled(snippet)}
          aria-label={`${snippet.status === 'enabled' ? 'Disable' : 'Enable'} ${snippet.title}`}
        >
          {snippet.status === 'enabled' ? 'Disable' : 'Enable'}
        </button>
        <button
          className="button button-small button-quiet"
          type="button"
          onClick={() => onEdit(snippet)}
        >
          Edit
        </button>
        <button
          className="button button-small button-quiet"
          type="button"
          onClick={() => onDuplicate(snippet)}
          aria-label={`Duplicate ${snippet.title}`}
        >
          Duplicate
        </button>
        <button
          className="button button-small button-danger-quiet"
          type="button"
          onClick={() => onDelete(snippet)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

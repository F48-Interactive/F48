const STATUS_MAP: Record<string, { className: string; label: string }> = {
  draft:                { className: 'badge-draft',     label: 'Draft' },
  published:            { className: 'badge-published', label: 'Published' },
  registration_open:    { className: 'badge-open',      label: 'Bookings Open' },
  registration_closed:  { className: 'badge-warning',   label: 'Bookings Held' },
  check_in:             { className: 'badge-warning',   label: 'Check-in' },
  live:                 { className: 'badge-live',       label: 'LIVE' },
  provisional_results:  { className: 'badge-warning',   label: 'Provisional Results' },
  dispute_window:       { className: 'badge-warning',   label: 'Dispute Window' },
  results_final:        { className: 'badge-success',   label: 'Results Final' },
  completed:            { className: 'badge-muted',     label: 'Completed' },
  canceled:             { className: 'badge-error',     label: 'Canceled' },
  voided:               { className: 'badge-error',     label: 'Voided' },
  archived:             { className: 'badge-draft',     label: 'Archived' },
};

interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  const config = STATUS_MAP[status] || { className: 'badge-muted', label: status };
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}

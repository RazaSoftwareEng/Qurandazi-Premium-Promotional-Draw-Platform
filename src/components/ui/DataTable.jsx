import { EmptyState, ErrorState, TableSkeleton } from './Feedback'
import Pagination from './Pagination'

/**
 * Responsive data table. On small screens rows collapse into stacked cards.
 * columns: [{ key, header, render?: (row) => node, className?, hideOnMobile? }]
 */
export default function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  rowKey = 'id',
  empty,
  page,
  pageSize,
  total,
  onPageChange,
  onRowClick,
  toolbar,
}) {
  const hasRows = rows && rows.length > 0
  return (
    <div className="card overflow-hidden">
      {toolbar && <div className="border-b border-ivory-200 p-4">{toolbar}</div>}

      {loading && !hasRows ? (
        <TableSkeleton cols={Math.min(columns.length, 5)} />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !hasRows ? (
        empty || <EmptyState title="No records found" message="Try adjusting your search or filters." />
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto scrollbar-thin md:block">
            <table className="table-qz">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={c.className} scope="col">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row[rowKey]}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={onRowClick ? 'cursor-pointer' : ''}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={c.className}>
                        {c.render ? c.render(row) : row[c.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y divide-ivory-200 md:hidden">
            {rows.map((row) => (
              <li
                key={row[rowKey]}
                className={`space-y-2 px-4 py-4 ${onRowClick ? 'cursor-pointer active:bg-ivory-100' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns
                  .filter((c) => !c.hideOnMobile)
                  .map((c) => (
                    <div key={c.key} className="flex items-start justify-between gap-4 text-sm">
                      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-ink-muted">{c.header}</span>
                      <span className="min-w-0 text-right">{c.render ? c.render(row) : row[c.key] ?? '—'}</span>
                    </div>
                  ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {onPageChange && hasRows && (
        <div className="border-t border-ivory-200 px-4 py-3">
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  )
}

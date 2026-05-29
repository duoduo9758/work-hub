import { useMemo } from 'react'
import { filterRecordsByYear, sortRecords } from './leave-calc'
import { getCurrentLeaveYear } from '../../lib/date'
import LeaveRecordRow from './LeaveRecordRow'
import './LeaveHistoryTabs.css'

// ═══════════════════════════════════════════════════════════════════════════
// LeaveHistoryTabs — Use / Adjustment tabs + leave-year filter dropdown.
//
// Year filter affects ONLY the list here. The Summary remains all-time.
// (AC-LEAVE-28)
//
// Props:
//   records[]                 - full leave records (all types/years)
//   currentTab                - 'use' | 'adjustment'
//   onTabChange(tabId)
//   yearFilter                - 'current' | 'past' | 'all'
//   onYearFilterChange(value)
//   onEdit / onDelete         - row handlers
// ═══════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'use', label: '利用履歴' },
  { id: 'adjustment', label: '調整履歴' },
]

const YEAR_OPTIONS = [
  { value: 'current', label: '現在年度' },
  { value: 'past', label: '過去年度' },
  { value: 'all', label: 'すべて' },
]

export default function LeaveHistoryTabs({
  records, currentTab, onTabChange,
  yearFilter, onYearFilterChange,
  onEdit, onDelete,
}) {
  const filtered = useMemo(() => {
    const byType = records.filter(r => r.type === currentTab)
    const byYear = filterRecordsByYear(byType, yearFilter)
    return sortRecords(byYear)
  }, [records, currentTab, yearFilter])

  const leaveYear = getCurrentLeaveYear()

  return (
    <div className="leave-history">
      <div className="leave-history__controls">
        <nav className="leave-history__tabs" role="tablist" aria-label="履歴種別">
          {TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={currentTab === tab.id}
              className={
                'leave-history__tab' +
                (currentTab === tab.id ? ' leave-history__tab--active' : '')
              }
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <label className="leave-history__filter">
          <span className="leave-history__filter-label">年度</span>
          <select
            className="leave-history__filter-select"
            value={yearFilter}
            onChange={(e) => onYearFilterChange(e.target.value)}
            aria-label="年度フィルタ"
          >
            {YEAR_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 'current'
                  ? `${opt.label}（${leaveYear}年度）`
                  : opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="leave-history__empty">
          {currentTab === 'use' ? '利用履歴がありません' : '調整履歴がありません'}
        </p>
      ) : (
        <ul className="leave-history__list">
          {filtered.map(r => (
            <LeaveRecordRow
              key={r.id}
              record={r}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

import {
  calcBalance, formatHours, calcUsedThisLeaveYear, calcFullDaysPaid,
  hasCurrentYearAdjustment, PAID_FULL_DAYS_REQUIRED,
} from './leave-calc'
import { getCurrentLeaveYear, getLeaveYearStart, getLeaveYearEnd } from '../../lib/date'
import './LeaveSummary.css'

// ═══════════════════════════════════════════════════════════════════════════
// LeaveSummary — top of S3 (休暇).
//   PC: two metric cards side by side (paid / sick).
//   Mobile: stacked.
//   Each card: title, hero 残量, divider, secondary rows (取得済み / 5-day rule).
//
// Summary always reflects ALL records (year filter applies to history only).
// AC-LEAVE-28.
// ═══════════════════════════════════════════════════════════════════════════
export default function LeaveSummary({ records }) {
  const leaveYear = getCurrentLeaveYear()
  const yearStart = getLeaveYearStart(leaveYear)
  const yearEnd = getLeaveYearEnd(leaveYear)

  const paidBalance = calcBalance(records, 'paid')
  const sickBalance = calcBalance(records, 'sick')
  const paidUsed = calcUsedThisLeaveYear(records, 'paid', leaveYear)
  const sickUsed = calcUsedThisLeaveYear(records, 'sick', leaveYear)
  const fullDays = calcFullDaysPaid(records, leaveYear)
  const fullDaysOk = fullDays >= PAID_FULL_DAYS_REQUIRED

  // AC-LEAVE-32 (paid) — adjustment-zero notice has priority over 5-day warn
  const noPaidAdj = !hasCurrentYearAdjustment(records, 'paid', leaveYear)
  const noSickAdj = !hasCurrentYearAdjustment(records, 'sick', leaveYear)

  return (
    <section className="leave-summary" aria-label="休暇サマリ">
      <div className="leave-summary__grid">
        {/* Paid */}
        <div className="leave-summary__block">
          <h3 className="leave-summary__title">有給休暇</h3>

          <div className="leave-summary__primary">
            <span className="leave-summary__primary-label">残量</span>
            <span className="leave-summary__primary-value">{formatHours(paidBalance)}</span>
          </div>

          <hr className="leave-summary__divider" />

          <div className="leave-summary__row">
            <span className="leave-summary__row-label">今年度取得済み</span>
            <span className="leave-summary__row-value">{formatHours(paidUsed)}</span>
          </div>

          {noPaidAdj ? (
            // AC-LEAVE-B02: when current-year adjustment is missing, suppress
            // the 5-day-rule row to keep messaging focused.
            <p className="leave-summary__warn" role="status">
              現在年度の調整レコードがありません。年度付与を入力してください
            </p>
          ) : (
            <div className={'leave-summary__row ' +
              (fullDaysOk ? 'leave-summary__row--ok' : 'leave-summary__row--warn')}>
              <span className="leave-summary__row-label">丸1日取得</span>
              <span className="leave-summary__row-value">
                {fullDays} / {PAID_FULL_DAYS_REQUIRED}日
                <span className="leave-summary__note">
                  {fullDaysOk ? '（達成）' : '（未達、会社ルール目安）'}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Sick */}
        <div className="leave-summary__block">
          <h3 className="leave-summary__title">傷病休暇</h3>

          <div className="leave-summary__primary">
            <span className="leave-summary__primary-label">残量</span>
            <span className="leave-summary__primary-value">{formatHours(sickBalance)}</span>
          </div>

          <hr className="leave-summary__divider" />

          <div className="leave-summary__row">
            <span className="leave-summary__row-label">今年度取得済み</span>
            <span className="leave-summary__row-value">{formatHours(sickUsed)}</span>
          </div>

          {noSickAdj && (
            <p className="leave-summary__warn" role="status">
              現在年度の調整レコードがありません
            </p>
          )}
        </div>
      </div>

      <p className="leave-summary__footnote">
        ※ 今年度 = {yearStart.replace(/-/g, '/')}〜{yearEnd.replace(/-/g, '/')}<br/>
        ※ 残量は全期間累計
      </p>
    </section>
  )
}

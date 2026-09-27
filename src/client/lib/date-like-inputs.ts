/**
 * `<input>` の、日付・時刻を選ぶネイティブな型。0094
 *
 * `ResponsiveSheet` は、この型の欄にフォーカスが残っている間は外側クリックでシートを閉じない
 * (iOS Safari のネイティブな選択 UI の後始末を、外側クリックと誤認しないため)。
 * `keyboard-field-nav.ts` の Enter キーでの「次の欄へ」も、この型の欄では発動しない
 * (ネイティブな選択 UI の Enter に任せる)。
 */
export const DATE_LIKE_INPUT_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

/** Vite の `?raw` で読むファイル。テストの見本の iCal に使う */
declare module "*?raw" {
  const text: string;
  export default text;
}

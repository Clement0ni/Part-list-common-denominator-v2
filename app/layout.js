export const metadata = {
  title: "CSV Qty Consolidator V2",
  description: "Consolidate BLItemNo, ColorName and Qty from multiple CSV files."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

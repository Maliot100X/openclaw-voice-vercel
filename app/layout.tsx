export const metadata = {
  title: 'OpenClaw Voice | Supreme Backup King',
  description: 'Voice interface for OpenClaw - The Supreme Backup King',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">{children}</body>
    </html>
  );
}

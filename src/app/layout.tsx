import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "investingfun — value + momentum + buzz",
  description:
    "Buffett-style DCF, momentum, options sentiment and social buzz, combined into multi-horizon buy ratings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container" style={{ paddingTop: 24, paddingBottom: 64 }}>
          {children}
        </div>
      </body>
    </html>
  );
}

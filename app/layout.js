import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "CharacterChat",
  description: "Chat with AI characters",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="app-shell">
          <Navbar />

          <main className="page-transition">{children}</main>
        </div>
      </body>
    </html>
  );
}

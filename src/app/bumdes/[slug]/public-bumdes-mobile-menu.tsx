"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import styles from "./page.module.css";

type NavItem = {
  label: string;
  href: string;
};

export function PublicBumdesMobileMenu({ navItems }: { navItems: NavItem[] }) {
  return (
    <details className={styles.mobileMenu}>
      <summary className={styles.mobileMenuButton}>
        <Menu size={20} />
        <span>Menu</span>
      </summary>

      <div className={styles.mobileMenuOverlay}>
        <div className={styles.mobileMenuHeader}>
          <span>Menu BUMDes</span>
          <button
            type="button"
            className={styles.mobileMenuClose}
            onClick={(event) => {
              const details = event.currentTarget.closest("details");
              if (details) details.open = false;
            }}
          >
            <X size={18} />
            Close
          </button>
        </div>

        <nav className={styles.mobileMenuPanel}>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(event) => {
                const details = event.currentTarget.closest("details");
                if (details) details.open = false;
              }}
            >
              {item.label}
            </a>
          ))}

          <div className={styles.mobileMenuActions}>
            <Link
              href="/login"
              onClick={(event) => {
                const details = event.currentTarget.closest("details");
                if (details) details.open = false;
              }}
            >
              Login
            </Link>
            <Link
              href="/register"
              onClick={(event) => {
                const details = event.currentTarget.closest("details");
                if (details) details.open = false;
              }}
            >
              Signup
              <ArrowRight size={14} />
            </Link>
          </div>
        </nav>
      </div>
    </details>
  );
}
"use client";

import React, { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

const sizeStyles: Record<string, string> = {
  sm: "max-width: 400px",
  md: "max-width: 560px",
  lg: "max-width: 800px",
  xl: "max-width: 1000px",
  full: "max-width: 95vw; width: 95vw",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  footer,
  className = "",
}: ModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && closeOnEscape) {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-backdrop" onClick={closeOnOverlayClick ? onClose : undefined} style={{ 
      position: "fixed", 
      inset: 0, 
      background: "rgba(0,0,0,.45)", 
      display: "grid", 
      placeItems: "center", 
      zIndex: 200, 
      padding: "20px" 
    }}>
      <div 
        className="modal" 
        style={{ 
          background: "var(--surface)", 
          borderRadius: "12px", 
          width: "100%", 
          maxWidth: size === "full" ? "95vw" : undefined,
          boxShadow: "0 20px 60px rgba(0,0,0,.2)", 
          overflow: "hidden",
          ...(sizeStyles[size] ? { style: sizeStyles[size] } : {}),
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header" style={{ 
          padding: "20px 24px 16px", 
          borderBottom: "1px solid var(--border-light)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between" 
        }}>
          <h2 id="modal-title" style={{ 
            fontFamily: "'Manrope', sans-serif", 
            fontSize: 16, 
            fontWeight: 700 
          }}>
            {title}
          </h2>
          {showCloseButton && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={onClose}
              style={{ 
                padding: 8, 
                width: 36, 
                height: 36, 
                display: "grid", 
                placeItems: "center",
                borderRadius: 8,
              }}
              aria-label="Close modal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        <div className="modal-body" style={{ padding: "20px 24px" }}>
          {children}
        </div>
        {footer && (
          <div className="modal-footer" style={{ 
            padding: "16px 24px", 
            borderTop: "1px solid var(--border-light)", 
            display: "flex", 
            justifyContent: "flex-end", 
            gap: 10 
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modalContent, document.body);
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "secondary";
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  loading = false,
}: ConfirmModalProps) {
  const handleConfirm = () => {
    if (!loading) onConfirm();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" footer={
      <>
        <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </button>
        <button 
          className={`btn btn-${variant === "danger" ? "danger" : variant === "primary" ? "primary" : "secondary"}`}
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? "Processing..." : confirmLabel}
        </button>
      </>
    }>
      <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.5 }}>{message}</p>
    </Modal>
  );
}
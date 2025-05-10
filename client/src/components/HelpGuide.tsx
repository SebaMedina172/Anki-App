import React, { useState } from 'react';
import ReactDOM from 'react-dom';  // Asegúrate de tener react-dom instalado

export function Modal({ children, isOpen, onClose }: {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <button
          style={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div style={styles.content}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default function HelpGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(o => !o);

  return (
    <>
      <button
        onClick={toggle}
        aria-label="Ayuda"
        style={styles.helpButton}
      >
        ❔
      </button>

      <Modal isOpen={isOpen} onClose={toggle}>
        <h2>Cómo usar la app</h2>
        <ol>
          <li>Navega por el menú lateral para acceder a secciones.</li>
          <li>Usa “Add” para crear nuevos ítems.</li>
          <li>Haz clic en un ítem para editar o ver detalles.</li>
          <li>Filtra y ordena con las opciones en la parte superior.</li>
          <li>Si hay errores, revisa la consola o contacta soporte.</li>
        </ol>
      </Modal>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  helpButton: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 1000,
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 40,
    height: 40,
    fontSize: 20,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: 8,
    width: '90%',
    maxWidth: 500,
    padding: 24,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'transparent',
    border: 'none',
    fontSize: 24,
    cursor: 'pointer',
  },
  content: {
    marginTop: 16,
  },
};

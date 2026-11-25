import { useEffect, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Icon } from '../ui';

export const editorExtensions = [
  StarterKit.configure({ heading: { levels: [2, 3] }, link: false, code: false, codeBlock: false }),
  Image.configure({ allowBase64: true, inline: false }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
];

export function useArticleEditor(initial: JSONContent | null, onUpdate: (json: JSONContent, text: string) => void) {
  return useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: 'Écris ton article ici…' })],
    content: initial ?? '',
    editorProps: {
      attributes: { class: 'prose', spellcheck: 'true', lang: 'fr', autocorrect: 'on', autocapitalize: 'sentences' },
    },
    onUpdate: ({ editor }) => onUpdate(editor.getJSON(), editor.getText({ blockSeparator: '\n' })),
  });
}

/** Barre d'outils de mise en forme, collée au-dessus du clavier. */
export function EditorToolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      quote: e.isActive('blockquote'),
      ul: e.isActive('bulletList'),
      ol: e.isActive('orderedList'),
      center: e.isActive({ textAlign: 'center' }),
      justify: e.isActive({ textAlign: 'justify' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      focused: e.isFocused,
    }),
  });
  const offset = useKeyboardOffset();
  const c = () => editor.chain().focus();
  const B = ({ on, label, onClick, children, disabled }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button
      className={`tb-btn ${on ? 'on' : ''}`}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
  return (
    <div className="editor-toolbar" style={{ bottom: offset }}>
      <div className="tb-scroll">
        <B label="Annuler" disabled={!s.canUndo} onClick={() => c().undo().run()}><Icon name="undo" size={20} /></B>
        <B label="Rétablir" disabled={!s.canRedo} onClick={() => c().redo().run()}><Icon name="redo" size={20} /></B>
        <span className="tb-sep" />
        <B label="Intertitre" on={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><b className="tb-txt">T1</b></B>
        <B label="Sous-titre" on={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><b className="tb-txt small">T2</b></B>
        <B label="Gras" on={s.bold} onClick={() => c().toggleBold().run()}><b className="tb-txt">G</b></B>
        <B label="Italique" on={s.italic} onClick={() => c().toggleItalic().run()}><i className="tb-txt serif">I</i></B>
        <B label="Souligné" on={s.underline} onClick={() => c().toggleUnderline().run()}><u className="tb-txt">S</u></B>
        <B label="Barré" on={s.strike} onClick={() => c().toggleStrike().run()}><s className="tb-txt">B</s></B>
        <span className="tb-sep" />
        <B label="Citation" on={s.quote} onClick={() => c().toggleBlockquote().run()}><Icon name="quote" size={20} /></B>
        <B label="Liste à puces" on={s.ul} onClick={() => c().toggleBulletList().run()}><Icon name="list" size={20} /></B>
        <B label="Liste numérotée" on={s.ol} onClick={() => c().toggleOrderedList().run()}><Icon name="olist" size={20} /></B>
        <B label="Image" onClick={onImage}><Icon name="image" size={20} /></B>
        <B label="Séparateur" onClick={() => c().setHorizontalRule().run()}><Icon name="hr" size={20} /></B>
        <span className="tb-sep" />
        <B label="Centrer" on={s.center} onClick={() => (s.center ? c().unsetTextAlign().run() : c().setTextAlign('center').run())}><Icon name="alignCenter" size={20} /></B>
        <B label="Justifier" on={s.justify} onClick={() => (s.justify ? c().unsetTextAlign().run() : c().setTextAlign('justify').run())}><Icon name="alignJustify" size={20} /></B>
      </div>
    </div>
  );
}

/** Hauteur du clavier virtuel, pour garder la barre d'outils visible juste au-dessus. */
export function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return offset;
}

export { EditorContent };

"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import styles from "./PolicyRichEditor.module.css";

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px"] as const;

type Props = {
  /** 저장·전송용 HTML (`<p>`, `<strong>`, 인라인 `font-size` 등) */
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

function normalizeEmpty(html: string) {
  const t = html.trim();
  if (!t || t === "<p></p>" || t === "<p><br></p>") return "<p></p>";
  return html;
}

export function PolicyRichEditor({
  html,
  onChange,
  placeholder = "문단·굵기·글자 크기 등을 적용해 작성하세요.",
  disabled = false,
}: Props) {
  const [sizeSelect, setSizeSelect] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    /** 툴바 활성 상태(굵게 등) 갱신 */
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      TextStyle,
      FontSize,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: {
      attributes: {
        class: styles.proseMirror,
      },
    },
    content: normalizeEmpty(html),
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const next = normalizeEmpty(html);
    const cur = editor.getHTML();
    if (cur === next) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [html, editor]);

  if (!editor) {
    return <div className={styles.shell} aria-hidden />;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarGroupLabel}>형식</span>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="본문 문단"
        >
          본문
        </button>
        <button
          type="button"
          className={
            editor.isActive("heading", { level: 2 })
              ? styles.toolbarBtnOn
              : styles.toolbarBtn
          }
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          제목2
        </button>
        <button
          type="button"
          className={
            editor.isActive("heading", { level: 3 })
              ? styles.toolbarBtnOn
              : styles.toolbarBtn
          }
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          제목3
        </button>
        <button
          type="button"
          className={
            editor.isActive("heading", { level: 4 })
              ? styles.toolbarBtnOn
              : styles.toolbarBtn
          }
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 4 }).run()
          }
        >
          제목4
        </button>

        <button
          type="button"
          className={
            editor.isActive("bold") ? styles.toolbarBtnOn : styles.toolbarBtn
          }
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="굵게"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={
            editor.isActive("italic") ? styles.toolbarBtnOn : styles.toolbarBtn
          }
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="기울임"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={
            editor.isActive("underline")
              ? styles.toolbarBtnOn
              : styles.toolbarBtn
          }
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="밑줄"
        >
          U
        </button>
        <button
          type="button"
          className={
            editor.isActive("strike") ? styles.toolbarBtnOn : styles.toolbarBtn
          }
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="취소선"
        >
          S
        </button>

        <select
          className={styles.toolbarSelect}
          aria-label="글자 크기"
          value={sizeSelect}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            if (v === "default") {
              editor.chain().focus().unsetFontSize().run();
            } else {
              editor.chain().focus().setFontSize(v).run();
            }
            setSizeSelect("");
          }}
        >
          <option value="">크기</option>
          <option value="default">기본</option>
          {FONT_SIZES.map((px) => (
            <option key={px} value={px}>
              {px}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={
            editor.isActive("bulletList")
              ? styles.toolbarBtnOn
              : styles.toolbarBtn
          }
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="글머리 목록"
        >
          • 목록
        </button>
        <button
          type="button"
          className={
            editor.isActive("orderedList")
              ? styles.toolbarBtnOn
              : styles.toolbarBtn
          }
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="번호 목록"
        >
          1. 목록
        </button>

        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("링크 URL", prev ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
          title="링크"
        >
          링크
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="서식 지우기"
        >
          서식 지우기
        </button>
      </div>
      <div className={styles.shell}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Link2, List, ListOrdered, Heading2, Quote, Code } from "lucide-react";

export function MarkdownView({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-a:text-primary prose-strong:text-foreground prose-code:text-secondary ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ""}</ReactMarkdown>
    </div>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  rows = 8,
  placeholder = "Escreva em Markdown… **negrito**, *itálico*, [link](url), listas, etc.",
  maxLength = 10000,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}) {
  const [tab, setTab] = useState("write");

  const wrap = (before: string, after = before, placeholder = "") => {
    const ta = document.activeElement as HTMLTextAreaElement | null;
    const start = ta && "selectionStart" in ta ? ta.selectionStart ?? value.length : value.length;
    const end = ta && "selectionEnd" in ta ? ta.selectionEnd ?? value.length : value.length;
    const sel = value.slice(start, end) || placeholder;
    onChange(value.slice(0, start) + before + sel + after + value.slice(end));
  };
  const prefixLine = (prefix: string) => onChange((value ? value + "\n" : "") + prefix);

  const count = value?.length ?? 0;
  const over = count > maxLength;

  return (
    <div className="space-y-2">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="write">Editar</TabsTrigger>
            <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
          </TabsList>
          {tab === "write" && (
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => wrap("**", "**", "negrito")} title="Negrito"><Bold className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => wrap("*", "*", "itálico")} title="Itálico"><Italic className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => wrap("## ", "", "Título")} title="Título"><Heading2 className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => wrap("[", "](https://)", "texto")} title="Link"><Link2 className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => prefixLine("- item")} title="Lista"><List className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => prefixLine("1. item")} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => wrap("> ", "", "citação")} title="Citação"><Quote className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => wrap("`", "`", "código")} title="Código"><Code className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </div>
        <TabsContent value="write" className="mt-2">
          <Textarea
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="font-mono text-sm"
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-2">
          <div className="glass rounded-md border border-border/40 p-4 min-h-[120px]">
            {value?.trim() ? <MarkdownView>{value}</MarkdownView> : <p className="text-xs text-muted-foreground">Nada para pré-visualizar.</p>}
          </div>
        </TabsContent>
      </Tabs>
      <div className={`text-[10px] text-right ${over ? "text-destructive" : "text-muted-foreground"}`}>
        {count}/{maxLength}{over ? " — excedeu o limite" : ""}
      </div>
    </div>
  );
}
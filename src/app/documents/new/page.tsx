"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentEditor } from "@/components/documents/document-editor";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/doc-model";

function NewDocument() {
    const tipo = useSearchParams().get("tipo") as DocumentType | null;
    const initialType = tipo && DOCUMENT_TYPES.includes(tipo) ? tipo : "Cotação";
    return <DocumentEditor key={initialType} initialType={initialType} />;
}

export default function NewDocumentPage() {
    return <Suspense fallback={null}><NewDocument /></Suspense>;
}

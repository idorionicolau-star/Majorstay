
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import type { Product } from '@/lib/types';
import Papa from 'papaparse';

type ProductImportData = Omit<Product, 'id' | 'stock' | 'instanceId' | 'reservedStock' | 'location' | 'lastUpdated'>;

interface DataImporterProps {
  onImport: (products: ProductImportData[]) => void;
}


export function DataImporter({ onImport }: DataImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const processData = (data: string) => {
    if (!data.trim()) {
      toast({ variant: 'destructive', title: 'Nenhum dado para importar' });
      return;
    }

    Papa.parse<any>(data, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.error("CSV Parsing errors: ", results.errors);
          toast({ variant: 'destructive', title: 'Erro ao Ler CSV', description: 'Verifique o formato do seu ficheiro.' });
          return;
        }

        const requiredHeaders = ["Nome", "Categoria", "Preço", "Alerta Baixo", "Alerta Crítico"];
        const headers = results.meta.fields || [];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
            toast({ variant: 'destructive', title: 'Cabeçalhos em Falta', description: `Faltam as seguintes colunas: ${missingHeaders.join(', ')}` });
            return;
        }

        const productsToImport: ProductImportData[] = results.data.map(row => ({
          name: row["Nome"],
          category: row["Categoria"],
          price: parseFloat(row["Preço"] || 0),
          lowStockThreshold: parseInt(row["Alerta Baixo"] || '10', 10),
          criticalStockThreshold: parseInt(row["Alerta Crítico"] || '5', 10),
          unit: row["Unidade"] || "un",
        }));

        onImport(productsToImport);
        setFile(null);
      }
    });
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
    }
  };

  const handleImportFile = () => {
    if (!file) {
       toast({ variant: 'destructive', title: 'Nenhum ficheiro selecionado' });
       return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      processData(content);
    };
    reader.onerror = () => {
        toast({ variant: 'destructive', title: 'Erro de Leitura', description: 'Não foi possível ler o ficheiro.' });
    }
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
       <p className="text-sm text-muted-foreground">
        Carregue um ficheiro CSV para importar o seu catálogo de produtos. O formato esperado é CSV com os cabeçalhos: `Nome`, `Categoria`, `Preço`, `Unidade`, `Alerta Baixo`, `Alerta Crítico`.
      </p>
      <div className="space-y-3">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="catalog-file">Ficheiro do Catálogo</Label>
          <Input id="catalog-file" type="file" accept=".csv" onChange={handleFileChange} />
        </div>
        {file && <p className="text-sm text-muted-foreground">Ficheiro selecionado: <strong>{file.name}</strong></p>}
        <Button onClick={handleImportFile} className="w-full">
          <UploadCloud className="mr-2 h-4 w-4" />
          Importar Catálogo de Ficheiro
        </Button>
      </div>
    </div>
  );
}

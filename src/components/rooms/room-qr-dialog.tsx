'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, ExternalLink, Copy, Check, QrCode, Hotel, Sparkles } from 'lucide-react';
import type { Room } from '@/lib/types';
import { useInventory } from '@/context/inventory-context';
import { toast } from '@/hooks/use-toast';

interface RoomQrDialogProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoomQrDialog({ room, open, onOpenChange }: RoomQrDialogProps) {
  const { companyId, companyData } = useInventory();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const safeCompanyId = companyId || 'guest';
  const hotelName = companyData?.name || 'MajorStay Hospitality';

  const roomUrl = typeof window !== 'undefined' && room
    ? `${window.location.origin}/quarto?c=${encodeURIComponent(safeCompanyId)}&r=${encodeURIComponent(room.id)}`
    : '';

  useEffect(() => {
    if (open && roomUrl) {
      QRCode.toDataURL(roomUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#251D18',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Erro ao gerar QR code:', err));
    }
  }, [open, roomUrl]);

  const handleCopy = () => {
    if (!roomUrl) return;
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    toast({
      title: 'Link copiado!',
      description: 'O link de acesso do quarto foi copiado para a área de transferência.',
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    if (!room || !qrDataUrl) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        variant: 'destructive',
        title: 'Bloqueador de pop-ups ativo',
        description: 'Permita pop-ups para imprimir o cartão do quarto.',
      });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="utf-8" />
        <title>Cartão de Mesa - ${room.name}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #f7f5f0;
          }
          .card-container {
            width: 95mm;
            padding: 24px;
            background: #ffffff;
            border: 2px solid #C58A2C;
            border-radius: 18px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          }
          .hotel-title {
            font-size: 13px;
            letter-spacing: 2px;
            text-transform: uppercase;
            font-weight: 700;
            color: #C58A2C;
            margin-bottom: 4px;
          }
          .room-name {
            font-size: 24px;
            font-weight: 800;
            color: #1a1a1a;
            margin-bottom: 2px;
          }
          .room-type {
            font-size: 12px;
            color: #777;
            text-transform: uppercase;
            margin-bottom: 16px;
          }
          .qr-img {
            width: 190px;
            height: 190px;
            margin: 0 auto;
            display: block;
            border: 1px solid #eee;
            border-radius: 12px;
            padding: 6px;
          }
          .instructions {
            margin-top: 16px;
            font-size: 12px;
            line-height: 1.4;
            color: #444;
            font-weight: 500;
          }
          .features {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px dashed #e0d8cc;
            display: flex;
            justify-content: space-around;
            font-size: 10px;
            font-weight: 600;
            color: #C58A2C;
          }
          @media print {
            body {
              background: #fff;
            }
            .card-container {
              box-shadow: none;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="card-container">
          <div class="hotel-title">${hotelName}</div>
          <div class="room-name">${room.name}</div>
          <div class="room-type">${room.type ? `${room.type} Suite` : 'Acomodação'}</div>
          <img class="qr-img" src="${qrDataUrl}" alt="QR Code" />
          <p class="instructions">
            Aponte a câmara do telemóvel para aceder ao tempo de estadia, senha do Wi-Fi e pedidos de bar.
          </p>
          <div class="features">
            <span>⏱️ Tempo de Estadia</span>
            <span>📶 Senha Wi-Fi</span>
            <span>🍸 Menu do Bar</span>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!room) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] text-[#251D18] dark:text-[#F5EFEB] shadow-xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FDF6E8] dark:bg-[#2A2118] border border-[#F6E0B5] dark:border-[#523A2C] flex items-center justify-center text-[#C58A2C]">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-[#251D18] dark:text-[#F5EFEB]">
                Visor de Quarto & QR Code
              </DialogTitle>
              <p className="text-xs text-[#827568] dark:text-[#B0A294]">
                {room.name} · Cartão para mesa ou dispositivo na parede
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Pré-visualização do Cartão */}
        <div className="my-2 p-5 rounded-2xl border-2 border-dashed border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] text-center space-y-3">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#C58A2C]">
              {hotelName}
            </span>
            <h3 className="text-xl font-extrabold text-[#251D18] dark:text-[#F5EFEB] leading-tight mt-0.5">
              {room.name}
            </h3>
            <p className="text-xs text-stone-500 capitalize">{room.type || 'Standard'}</p>
          </div>

          <div className="flex justify-center py-1">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code ${room.name}`}
                className="w-48 h-48 rounded-xl border border-stone-200 dark:border-stone-800 p-2 bg-white shadow-xs"
              />
            ) : (
              <div className="w-48 h-48 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse flex items-center justify-center text-xs text-stone-400">
                A gerar QR Code...
              </div>
            )}
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-300 px-4 leading-relaxed font-medium">
            O hóspede aponta o telemóvel para consultar o tempo restante de forma discreta, ver a senha do Wi-Fi e pedir bebidas no bar.
          </p>

          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-center gap-3 text-[11px] text-[#C58A2C] font-semibold">
            <span>⏱️ Sem Pressão</span>
            <span>•</span>
            <span>📶 Wi-Fi 1-Toque</span>
            <span>•</span>
            <span>🍸 Bar WhatsApp</span>
          </div>
        </div>

        <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            className="w-full sm:w-auto h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] text-stone-700 dark:text-stone-300"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
            Copiar Link
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(roomUrl, '_blank')}
            className="w-full sm:w-auto h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] text-stone-700 dark:text-stone-300"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Abrir Visor
          </Button>

          <Button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto h-10 text-xs font-bold rounded-xl bg-gradient-to-r from-[#C58A2C] to-[#C86A2B] hover:from-[#A87019] hover:to-[#B55E22] text-white shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Imprimir Cartão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

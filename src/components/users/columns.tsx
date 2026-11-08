"use client"

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table"
import { Employee, ModulePermission, PermissionLevel } from "@/lib/types"
import { Button } from "../ui/button"
import { Trash2, Edit, Copy, Eye, Pencil } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { allPermissions } from "@/lib/data"
import { cn } from "@/lib/utils"
import Link from 'next/link';

interface ColumnsOptions {
    onDelete: (employee: Employee) => void;
    currentUserId?: string | null;
    isAdmin: boolean;
    companyName: string | null;
}

const LoginFormatCell = ({ row, companyName, isAdmin }: { row: any, companyName: string | null, isAdmin: boolean }) => {
    const { toast } = useToast();
    const email = row.original.email;

    const handleCopy = async () => {
        if (!isAdmin) {
            toast({
                variant: "destructive",
                title: "Ação não permitida",
                description: "Apenas administradores podem copiar o email.",
            });
            return;
        }

        const textToCopy = email;

        if (!document.hasFocus()) {
            window.focus();
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            toast({
                title: "Email Copiado",
                description: "O email de login foi copiado.",
            });
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                toast({ title: "Copiado", description: "Email copiado (via fallback)." });
            } catch (e) {
                console.error("Erro ao copiar: ", e);
                toast({ variant: "destructive", title: "Erro", description: "Não foi possível copiar o email." });
            }
            document.body.removeChild(textArea);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <span className="font-mono text-xs p-2 rounded-md bg-muted text-muted-foreground">{email}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy} disabled={!isAdmin}>
                <Copy className="h-4 w-4" />
            </Button>
        </div>
    )
}

export const columns = (options: ColumnsOptions): ColumnDef<Employee>[] => {

    const baseColumns: ColumnDef<Employee>[] = [
        {
            accessorKey: "username",
            header: "Nome de Utilizador",
        },
        {
            id: 'loginFormat',
            header: 'Email de Login',
            cell: ({ row }) => <LoginFormatCell row={row} companyName={options.companyName} isAdmin={options.isAdmin} />
        },
        {
            accessorKey: "role",
            header: "Função",
            cell: ({ row }) => {
                const role = row.original.role;
                return (
                    <span className={cn(
                        "text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider",
                        role === 'Admin' && 'bg-[hsl(var(--chart-4))]/20 text-[hsl(var(--chart-4))]',
                        role === 'Dono' && 'bg-[hsl(var(--chart-5))]/20 text-[hsl(var(--chart-5))]',
                        role === 'Employee' && 'bg-muted text-muted-foreground'
                    )}>
                        {role}
                    </span>
                )
            }
        },
        {
            accessorKey: 'permissions',
            header: 'Permissões',
            cell: ({ row }) => {
                const permissions = row.original.permissions || {};
                const role = row.original.role;
                if (role === 'Admin') {
                    return <span className="text-xs text-muted-foreground italic">Acesso total de escrita</span>;
                }
                if (role === 'Dono') {
                    return <span className="text-xs text-muted-foreground italic">Acesso total de leitura</span>;
                }

                const grantedPermissions = Object.entries(permissions)
                    .filter(([, level]) => level !== 'none')
                    .map(([id, level]) => ({
                        label: allPermissions.find(p => p.id === id)?.label || id,
                        level
                    }));

                if (grantedPermissions.length === 0) {
                    return <span className="text-xs text-muted-foreground italic">Nenhuma</span>;
                }

                return (
                    <div className="flex flex-wrap gap-1 max-w-sm">
                        {grantedPermissions.map(({ label, level }) => (
                            <span key={label} className={cn(
                                "flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
                                level === 'write'
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'
                            )}>
                                {level === 'write' ? <Pencil className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                                {label}
                            </span>
                        ))}
                    </div>
                )
            }
        }
    ];

    if (options.isAdmin) {
        baseColumns.push({
            id: "actions",
            cell: ({ row }) => {
                const employee = row.original;
                const isCurrentUser = employee.id === options.currentUserId;

                return (
                    <div className="text-right flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-blue-500 hover:text-blue-600">
                            <Link href={`/users/${employee.id}/edit`}>
                                <Edit className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => options.onDelete(employee)}
                            disabled={isCurrentUser}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            }
        });
    }

    return baseColumns;
};

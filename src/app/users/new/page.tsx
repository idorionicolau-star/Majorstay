"use client";

import { haul } from '@/lib/haul';
import { useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from 'next/link';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useDynamicPlaceholder } from '@/hooks/use-dynamic-placeholder';

import type { ModulePermission, PermissionLevel } from '@/lib/types';
import { allPermissions } from '@/lib/data';
import { InventoryContext } from "@/context/inventory-context";
import { authedFetch } from "@/lib/api-client";

const formSchema = z.object({
    username: z.string().min(3, { message: "O nome de utilizador deve ter pelo menos 3 caracteres." }),
    email: z.string().min(1, { message: "O email base é obrigatório." }).refine(s => !s.includes('@'), 'Não inclua o "@" no email base.'),
    password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
    role: z.enum(['Admin', 'Employee', 'Dono'], { required_error: "A função é obrigatória." }),
    permissions: z.record(z.string(), z.enum(['none', 'read', 'write'])),
});

type AddEmployeeFormValues = z.infer<typeof formSchema>;

export default function NewUserPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { companyId, user, companyData } = useContext(InventoryContext) || {};
    const [isSubmitting, setIsSubmitting] = useState(false);

    const usernamePlaceholder = useDynamicPlaceholder('person');
    const emailPlaceholder = useDynamicPlaceholder('email');

    const defaultPermissions = allPermissions.reduce((acc, perm) => {
        acc[perm.id] = (['dashboard', 'diagnostico'].includes(perm.id)) ? 'read' : 'none';
        return acc;
    }, {} as Record<ModulePermission, PermissionLevel>);

    const form = useForm<AddEmployeeFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            email: "",
            password: "",
            role: 'Employee',
            permissions: defaultPermissions,
        },
    });

    const role = form.watch('role');

    const handlePermissionChange = (moduleId: ModulePermission, level: 'read' | 'write') => {
        const currentPermissions = form.getValues('permissions');
        const currentLevel = currentPermissions[moduleId];

        if (level === 'write') {
            const newLevel = currentLevel === 'write' ? 'read' : 'write';
            form.setValue(`permissions.${moduleId}`, newLevel, { shouldDirty: true });
        } else {
            const newLevel = currentLevel === 'read' || currentLevel === 'write' ? 'none' : 'read';
            form.setValue(`permissions.${moduleId}`, newLevel === 'none' ? 'none' : 'read', { shouldDirty: true });
        }
    };

    async function onSubmit(values: AddEmployeeFormValues) {
        if (!companyId || !companyData) return;

        setIsSubmitting(true);

        const safeCompanyName = (companyData.name || "company").toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');
        const fullEmail = `${values.email}@${safeCompanyName}.com`;

        try {
            const permissionsForAdmin = allPermissions.reduce((acc, perm) => {
                acc[perm.id] = 'write';
                return acc;
            }, {} as Record<ModulePermission, PermissionLevel>);

            const permissionsForDono = allPermissions.reduce((acc, perm) => {
                acc[perm.id] = 'read';
                return acc;
            }, {} as Record<ModulePermission, PermissionLevel>);

            let finalPermissions = values.permissions;
            if (role === 'Admin') finalPermissions = permissionsForAdmin;
            else if (role === 'Dono') finalPermissions = permissionsForDono;

            // A conta de acesso e o registo são criados no servidor (as regras do Firestore
            // não deixam um Admin criar o mapa de utilizador de outra pessoa).
            await haul('settings', 'A criar a conta…', 'Conta criada', () => authedFetch('/api/employees', 'POST', {
                companyId,
                username: values.username,
                email: fullEmail,
                password: values.password,
                role: values.role,
                permissions: finalPermissions,
            }));

            toast({
                title: "Funcionário Adicionado",
                description: `O funcionário "${values.username}" com o email "${fullEmail}" foi criado com sucesso.`,
            });
            router.push('/users');

        } catch (error: any) {
            const message = error?.message === 'Este email já está a ser utilizado.'
                ? `O prefixo de email "${values.email}" já está a ser utilizado nesta empresa.`
                : (error?.message || "Ocorreu um erro ao criar a conta.");
            toast({
                variant: "destructive",
                title: "Erro de Registo",
                description: message,
            });
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }

    const isAdmin = user?.role === 'Admin';
    if (!user || (!isAdmin && user.role !== 'Dono')) {
        return <div className="p-8 text-center text-red-500">Acesso negado. Apenas administradores podem gerir utilizadores.</div>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-bold">Novo Funcionário</h1>
                    <p className="text-muted-foreground text-sm">Crie uma conta de acesso ao sistema com permissões personalizadas.</p>
                </div>
            </div>

            <Card className="glass-panel p-6 border-none shadow-lg">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nome de Utilizador</FormLabel>
                                            <FormControl>
                                                <Input placeholder={usernamePlaceholder} {...field} className="h-12 bg-background/50" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Prefixo de Email de Acesso</FormLabel>
                                            <FormControl>
                                                <Input placeholder={emailPlaceholder.split('@')[0]} {...field} className="h-12 bg-background/50" />
                                            </FormControl>
                                            <FormDescription>
                                                O login final será: <span className="font-mono">{field.value || 'nome'}@{companyData?.name?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '') || 'empresa'}.com</span>
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Senha Provisória</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="Mínimo 6 caracteres" {...field} className="h-12 bg-background/50" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Função no Sistema</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 bg-background/50">
                                                        <SelectValue placeholder="Selecione a função" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Employee">Funcionário Padrão</SelectItem>
                                                    <SelectItem value="Admin">Administrador Total</SelectItem>
                                                    <SelectItem value="Dono">Visualizador Global (Dono)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-4">
                                {role === 'Employee' && (
                                    <div className="rounded-lg border p-4 bg-background/50 h-full">
                                        <div className="mb-4">
                                            <FormLabel className="text-base">Permissões de Módulos</FormLabel>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Defina o que este utilizador pode ver e/ou editar. "Editar" já inclui "Ver".
                                            </p>
                                        </div>
                                        <div className="rounded-md border overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead>Módulo</TableHead>
                                                        <TableHead className="text-center w-16">Ver</TableHead>
                                                        <TableHead className="text-center w-16">Edit</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {allPermissions.filter(p => !p.adminOnly).map((module) => {
                                                        const permissionValue = form.watch(`permissions.${module.id}`);
                                                        const canRead = permissionValue === 'read' || permissionValue === 'write';
                                                        const canWrite = permissionValue === 'write';

                                                        return (
                                                            <TableRow key={module.id} className="hover:bg-muted/20">
                                                                <TableCell className="font-medium text-sm">{module.label}</TableCell>
                                                                <TableCell className="text-center">
                                                                    <Checkbox
                                                                        checked={canRead}
                                                                        onCheckedChange={() => handlePermissionChange(module.id, 'read')}
                                                                        disabled={module.id === 'dashboard'}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Checkbox
                                                                        checked={canWrite}
                                                                        onCheckedChange={() => handlePermissionChange(module.id, 'write')}
                                                                        disabled={module.id === 'dashboard'}
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}

                                {role === 'Admin' && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-6 flex flex-col justify-center items-center text-center h-full">
                                        <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center mb-4">
                                            <span className="text-amber-600 dark:text-amber-400 font-bold">!</span>
                                        </div>
                                        <h3 className="font-bold text-amber-900 dark:text-amber-100 mb-2">Acesso Total</h3>
                                        <p className="text-sm text-amber-700 dark:text-amber-300">
                                            Esta função concede previlégios totais. O utilizador poderá ver e editar informações financeiras e definições da empresa.
                                        </p>
                                    </div>
                                )}

                                {role === 'Dono' && (
                                    <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800 p-6 flex flex-col justify-center items-center text-center h-full">
                                        <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-800/50 flex items-center justify-center mb-4">
                                            <span className="text-purple-600 dark:text-purple-400 font-bold">👁️</span>
                                        </div>
                                        <h3 className="font-bold text-purple-900 dark:text-purple-100 mb-2">Apenas Visualização</h3>
                                        <p className="text-sm text-purple-700 dark:text-purple-300">
                                            O utilizador tem acesso para auditar e visualizar todos os módulos e relatórios, mas não pode registar movimentos, vendas ou editar tabelas.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-6 border-t border-border mt-8">
                            <Button type="button" variant="outline" className="w-full sm:w-auto h-12" onClick={() => router.push('/users')}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="w-full sm:w-auto h-12 px-8 bg-primary text-primary-foreground" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmitting ? 'A criar a conta…' : 'Concluir Registo'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </Card>
        </div>
    );
}

"use client";

import { haul } from '@/lib/haul';
import { useMemo, useState, useContext, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { Loader2, Trash2 } from "lucide-react";
import Link from 'next/link';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useDynamicPlaceholder } from '@/hooks/use-dynamic-placeholder';

import type { Employee, ModulePermission, PermissionLevel } from '@/lib/types';
import { allPermissions } from '@/lib/data';
import { InventoryContext } from "@/context/inventory-context";
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { authedFetch } from "@/lib/api-client";
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { sitesOf } from '@/lib/sites';

const formSchema = z.object({
    username: z.string().min(3, { message: "O nome de utilizador deve ter pelo menos 3 caracteres." }),
    role: z.enum(['Admin', 'Employee', 'Dono'], { required_error: "A função é obrigatória." }),
    permissions: z.record(z.string(), z.enum(['none', 'read', 'write'])),
    site: z.string().optional(),
});

type EditEmployeeFormValues = z.infer<typeof formSchema>;

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params.id as string;
    const { toast } = useToast();
    const { companyId, user: currentUser, companyData } = useContext(InventoryContext) || {};
    const firestore = useFirestore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const employeeNamePlaceholder = useDynamicPlaceholder('person');

    // A referência TEM de ser memorizada: criada de novo a cada desenho, o useCollection voltava a subscrever,
    // mostrava "a carregar", recebia os dados, redesenhava… para sempre (a página de edição nunca abria).
    const employeesColRef = useMemoFirebase(
        () => (firestore && companyId ? collection(firestore, `companies/${companyId}/employees`) : null),
        [firestore, companyId]
    );
    const { data: employees, isLoading } = useCollection<Employee>(employeesColRef);

    const employeeToEdit = employees?.find(e => e.id === userId);
    const sites = useMemo(() => (companyData?.isMultiLocation ? sitesOf(companyData?.locations || []) : []), [companyData]);

    const form = useForm<EditEmployeeFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            role: "Employee",
            permissions: {},
            site: "",
        },
    });

    // preenche o formulário uma vez por funcionário (uma actualização da lista não apaga o que está a ser escrito)
    const filledFor = useRef<string | null>(null);
    useEffect(() => {
        if (employeeToEdit && filledFor.current !== employeeToEdit.id) {
            filledFor.current = employeeToEdit.id;
            form.reset({
                username: employeeToEdit.username,
                role: employeeToEdit.role,
                permissions: employeeToEdit.permissions || {},
                site: employeeToEdit.site || "",
            });
        }
    }, [employeeToEdit, form]);
    const notFound = !isLoading && !!employees && !employeeToEdit;

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

    async function onSubmit(values: EditEmployeeFormValues) {
        if (!firestore || !companyId || !employeeToEdit) return;

        setIsSubmitting(true);

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
            if (values.role === 'Admin') finalPermissions = permissionsForAdmin;
            else if (values.role === 'Dono') finalPermissions = permissionsForDono;

            // No servidor: as regras do Firestore não deixam mudar a função de um funcionário.
            await haul('settings', 'A guardar as alterações…', 'Alterações guardadas', () => authedFetch('/api/employees', 'PATCH', {
                companyId,
                employeeId: employeeToEdit.id,
                username: values.username,
                role: values.role,
                permissions: finalPermissions,
                // ponto: só para funcionários (Admin e Dono veem sempre tudo)
                site: values.role === 'Employee' ? (values.site || '') : '',
            }));

            toast({
                title: "Registo de Utilizador Atualizado",
                description: `As funções e permissões de ${values.username} foram guardadas.`,
                className: "border-emerald-500/50 text-emerald-500"
            });

            router.push('/users');

        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro de Atualização",
                description: error?.message || "Não foi possível atualizar as permissões do utilizador. Tente novamente.",
            });
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }

    const isAdmin = currentUser?.role === 'Admin';
    if (!currentUser || (!isAdmin && currentUser.role !== 'Dono')) {
        return <div className="p-8 text-center text-red-500">Acesso negado. Apenas administradores podem gerir utilizadores.</div>;
    }

    if (notFound) {
        return (
            <div className="p-8 text-center">
                <p className="text-muted-foreground">Este funcionário já não existe.</p>
                <Button asChild variant="outline" className="mt-4"><Link href="/users">Voltar aos funcionários</Link></Button>
            </div>
        );
    }
    if (isLoading || !employeeToEdit) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-bold">Editar Funcionário</h1>
                    <p className="text-muted-foreground text-sm">Atualize a função e as permissões de acesso da conta principal {employeeToEdit.email}.</p>
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
                                                <Input placeholder={employeeNamePlaceholder} {...field} className="h-12 bg-background/50" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormItem>
                                    <FormLabel>Email de Acesso (Login)</FormLabel>
                                    <Input value={employeeToEdit.email} disabled className="h-12 bg-muted text-muted-foreground font-mono" />
                                    <FormDescription>
                                        O email de acesso é o identificador único da conta e não pode ser editado.
                                    </FormDescription>
                                </FormItem>

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
                                {role === 'Employee' && sites.length > 0 && (
                                    <FormField
                                        control={form.control}
                                        name="site"
                                        render={({ field }) => (
                                            <FormItem className="rounded-lg border p-4">
                                                <FormLabel className="text-base">Ponto onde trabalha</FormLabel>
                                                <select value={field.value || ''} onChange={(e) => field.onChange(e.target.value)} data-testid="employee-site"
                                                    className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm">
                                                    <option value="">Todos os pontos (vê tudo)</option>
                                                    {sites.map((st) => <option key={st} value={st}>{st}</option>)}
                                                </select>
                                                <p className="text-xs text-muted-foreground">Com um ponto, só vê e vende o stock desse ponto. Pode transferir para outros pontos.</p>
                                            </FormItem>
                                        )}
                                    />
                                )}
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

                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-6 border-t border-border mt-8 justify-between">
                            <Button type="button" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 order-2 sm:order-1" disabled>
                                <Trash2 className="w-4 h-4 mr-2" /> Remover (Console)
                            </Button>

                            <div className="flex flex-col sm:flex-row gap-3 order-1 sm:order-2 w-full sm:w-auto">
                                <Button type="button" variant="outline" className="w-full sm:w-auto h-12" onClick={() => router.push('/users')}>
                                    Cancelar
                                </Button>
                                <Button type="submit" className="w-full sm:w-auto h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isSubmitting ? 'A guardar…' : 'Guardar Alterações'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </Card>
        </div>
    );
}

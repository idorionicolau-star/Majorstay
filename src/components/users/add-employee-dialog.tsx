
"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { PlusCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Employee, ModulePermission, PermissionLevel } from '@/lib/types';
import { allPermissions } from '@/lib/data';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useDynamicPlaceholder } from '@/hooks/use-dynamic-placeholder';

const formSchema = z.object({
  username: z.string().min(3, { message: "O nome de utilizador deve ter pelo menos 3 caracteres." }),
  email: z.string().min(1, { message: "O email base é obrigatório." }).refine(s => !s.includes('@'), 'Não inclua o "@" no email base.'),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
  role: z.enum(['Admin', 'Employee', 'Dono'], { required_error: "A função é obrigatória." }),
  permissions: z.record(z.string(), z.enum(['none', 'read', 'write'])),
});


type AddEmployeeFormValues = z.infer<typeof formSchema>;

interface AddEmployeeDialogProps {
  onAddEmployee: (employee: Omit<Employee, 'id' | 'companyId' | 'email'> & { email: string }) => void;
}

function AddEmployeeDialogContent({ onAddEmployee, setOpen }: AddEmployeeDialogProps & { setOpen: (open: boolean) => void }) {
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
    } else { // 'read'
      const newLevel = currentLevel === 'read' || currentLevel === 'write' ? 'none' : 'read';
      if (newLevel === 'none') {
        form.setValue(`permissions.${moduleId}`, 'none', { shouldDirty: true });
      } else {
        form.setValue(`permissions.${moduleId}`, 'read', { shouldDirty: true });
      }
    }
  };


  function onSubmit(values: AddEmployeeFormValues) {
    const permissionsForAdmin = allPermissions.reduce((acc, perm) => {
      acc[perm.id] = 'write';
      return acc;
    }, {} as Record<ModulePermission, PermissionLevel>);

    const permissionsForDono = allPermissions.reduce((acc, perm) => {
      acc[perm.id] = 'read';
      return acc;
    }, {} as Record<ModulePermission, PermissionLevel>);

    let finalPermissions = values.permissions;
    if (role === 'Admin') {
      finalPermissions = permissionsForAdmin;
    } else if (role === 'Dono') {
      finalPermissions = permissionsForDono;
    }

    const employeeData = {
      username: values.username,
      email: values.email,
      password: values.password,
      role: values.role,
      permissions: finalPermissions,
    };

    onAddEmployee(employeeData as any);
    form.reset({
      username: "",
      email: "",
      password: "",
      role: 'Employee',
      permissions: defaultPermissions,
    });
    setOpen(false);
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Adicionar Novo Funcionário</DialogTitle>
        <DialogDescription>
          Crie uma conta interna para um novo membro da equipe e defina as suas permissões de acesso.
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="md:max-h-[70vh] md:-mr-3 md:pr-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 pr-2">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome de Utilizador</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: joao.silva" {...field} />
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
                  <FormLabel>Email Base para Login</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: joao.silva" {...field} />
                  </FormControl>
                  <FormDescription>
                    O login final será no formato: email.base@nomeempresa.com
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
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
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
                  <FormLabel>Função Principal</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Employee">Funcionário</SelectItem>
                      <SelectItem value="Admin">Administrador</SelectItem>
                      <SelectItem value="Dono">Dono (Apenas Leitura)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {role === 'Employee' && (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base">Permissões de Acesso</FormLabel>
                  <FormDescription>
                    Defina o nível de acesso para cada módulo. "Editar" inclui "Ver".
                  </FormDescription>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Módulo</TableHead>
                        <TableHead className="text-center">Ver</TableHead>
                        <TableHead className="text-center">Editar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allPermissions.filter(p => !p.adminOnly).map((module) => {
                        const permissionValue = form.watch(`permissions.${module.id}`);
                        const canRead = permissionValue === 'read' || permissionValue === 'write';
                        const canWrite = permissionValue === 'write';

                        return (
                          <TableRow key={module.id}>
                            <TableCell className="font-medium">{module.label}</TableCell>
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
              </FormItem>
            )}

            {role === 'Admin' && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Administradores têm acesso de escrita a todos os módulos.</p>
              </div>
            )}
            {role === 'Dono' && (
              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-4 text-center">
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Donos têm acesso de leitura a todos os módulos, mas não podem editar.</p>
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Adicionar Funcionário</Button>
            </DialogFooter>
          </form>
        </Form>
      </ScrollArea>
    </DialogContent>
  );
}


export function AddEmployeeDialog(props: AddEmployeeDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Funcionário
        </Button>
      </DialogTrigger>
      {open && <AddEmployeeDialogContent {...props} setOpen={setOpen} />}
    </Dialog>
  );
}


'use client';

import type { Employee } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Edit, Mail, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface EmployeeCardProps {
    employee: Employee;
    onDelete: (employee: Employee) => void;
    currentUserId?: string | null;
    isAdmin: boolean;
}

export function EmployeeCard({ employee, onDelete, currentUserId, isAdmin }: EmployeeCardProps) {
    const isCurrentUser = employee.id === currentUserId;

    const getInitials = (name: string) => {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length > 1 && names[0] && names[names.length - 1]) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <Card>
            <CardContent className="p-4 flex gap-4">
                <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-lg bg-secondary text-secondary-foreground">{getInitials(employee.username)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                    <h3 className="font-bold">{employee.username}</h3>
                    <p className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider inline-block",
                        employee.role === 'Admin' && 'bg-[hsl(var(--chart-4))]/20 text-[hsl(var(--chart-4))]',
                        employee.role === 'Dono' && 'bg-[hsl(var(--chart-5))]/20 text-[hsl(var(--chart-5))]',
                        employee.role === 'Employee' && 'bg-muted text-muted-foreground'
                    )}>{employee.role}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                        <Mail size={14} />
                        {employee.email}
                    </p>
                </div>
            </CardContent>
            {isAdmin && (
                <CardFooter className="p-2 pt-0 flex gap-2">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link href={`/users/${employee.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                        </Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(employee)}
                        disabled={isCurrentUser}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Apagar
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}

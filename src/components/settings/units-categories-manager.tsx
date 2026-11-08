import { useState } from "react";
import { useInventory } from "@/context/inventory-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag, Ruler, Pencil, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { DialogFooter } from "@/components/ui/dialog";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

export function UnitsCategoriesManager() {
    const {
        availableUnits, addUnit, editUnit, removeUnit,
        availableCategories, addCategory, editCategory, removeCategory,
        canEdit
    } = useInventory();

    const { toast } = useToast();
    const [newUnit, setNewUnit] = useState("");
    const [newCategory, setNewCategory] = useState("");

    const [editingUnit, setEditingUnit] = useState<{ oldUnit: string, newUnit: string } | null>(null);
    const [editingCategory, setEditingCategory] = useState<{ oldCategory: string, newCategory: string } | null>(null);

    const handleAddUnit = async () => {
        if (!newUnit.trim()) return;
        if (availableUnits.includes(newUnit.trim())) {
            toast({ variant: "destructive", title: "Erro", description: "Esta unidade já existe." });
            return;
        }
        await addUnit(newUnit.trim());
        setNewUnit("");
    };

    const handleAddCategory = async () => {
        if (!newCategory.trim()) return;
        if (availableCategories.includes(newCategory.trim())) {
            toast({ variant: "destructive", title: "Erro", description: "Esta categoria já existe." });
            return;
        }
        await addCategory(newCategory.trim());
        setNewCategory("");
    };

    const handleEditUnit = async () => {
        if (!editingUnit || !editingUnit.newUnit.trim()) {
            setEditingUnit(null);
            return;
        }
        if (editingUnit.oldUnit === editingUnit.newUnit.trim()) {
            setEditingUnit(null);
            return;
        }
        if (availableUnits.includes(editingUnit.newUnit.trim()) && editingUnit.newUnit.trim() !== editingUnit.oldUnit) {
            toast({ variant: "destructive", title: "Erro", description: "Esta unidade já existe." });
            return;
        }
        await editUnit(editingUnit.oldUnit, editingUnit.newUnit.trim());
        setEditingUnit(null);
    };

    const handleEditCategory = async () => {
        if (!editingCategory || !editingCategory.newCategory.trim()) {
            setEditingCategory(null);
            return;
        }
        if (editingCategory.oldCategory === editingCategory.newCategory.trim()) {
            setEditingCategory(null);
            return;
        }
        if (availableCategories.includes(editingCategory.newCategory.trim()) && editingCategory.newCategory.trim() !== editingCategory.oldCategory) {
            toast({ variant: "destructive", title: "Erro", description: "Esta categoria já existe." });
            return;
        }
        await editCategory(editingCategory.oldCategory, editingCategory.newCategory.trim());
        setEditingCategory(null);
    };

    if (!canEdit('settings')) {
        return <div className="p-4 text-center text-slate-500">Você não tem permissão para editar estas configurações.</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Units Manager */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Ruler className="w-5 h-5 text-primary" />
                        Unidades de Medida
                    </CardTitle>
                    <CardDescription>
                        Gerencie as unidades disponíveis para os produtos (ex: kg, m³, un).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Nova unidade (ex: caixa)"
                            value={newUnit}
                            onChange={(e) => setNewUnit(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddUnit()}
                        />
                        <Button onClick={handleAddUnit} size="icon">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap gap-2">
                        {availableUnits.map((unit) => (
                            <div key={unit} className="group flex items-center gap-1.5 px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm font-medium">
                                <span>{unit}</span>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingUnit({ oldUnit: unit, newUnit: unit })} className="p-1 hover:text-primary transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => removeUnit(unit)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {availableUnits.length === 0 && (
                            <span className="text-sm text-slate-500 italic">Nenhuma unidade cadastrada.</span>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Categories Manager */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Tag className="w-5 h-5 text-primary" />
                        Categorias de Produtos
                    </CardTitle>
                    <CardDescription>
                        Organize seus produtos em categorias para facilitar a gestão.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Nova categoria (ex: Elétrica)"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        />
                        <Button onClick={handleAddCategory} size="icon">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap gap-2">
                        {availableCategories.map((cat) => (
                            <div key={cat} className="group flex items-center gap-1.5 px-3 py-1 border border-border bg-background text-foreground rounded-full text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <span>{cat}</span>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingCategory({ oldCategory: cat, newCategory: cat })} className="p-1 hover:text-primary transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => removeCategory(cat)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {availableCategories.length === 0 && (
                            <span className="text-sm text-slate-500 italic">Nenhuma categoria cadastrada.</span>
                        )}
                    </div>
                </CardContent>
            </Card>
            {/* Edit Dialogs */}
            <ResponsiveDialog
                open={!!editingUnit}
                onOpenChange={(open) => !open && setEditingUnit(null)}
                title="Editar Unidade"
            >
                <div className="py-4">
                    <Input
                        value={editingUnit?.newUnit || ""}
                        onChange={(e) => setEditingUnit(prev => prev ? { ...prev, newUnit: e.target.value } : null)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEditUnit()}
                        placeholder="Nome da unidade"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setEditingUnit(null)}>Cancelar</Button>
                    <Button onClick={handleEditUnit}>Guardar</Button>
                </div>
            </ResponsiveDialog>

            <ResponsiveDialog
                open={!!editingCategory}
                onOpenChange={(open) => !open && setEditingCategory(null)}
                title="Editar Categoria"
            >
                <div className="py-4">
                    <Input
                        value={editingCategory?.newCategory || ""}
                        onChange={(e) => setEditingCategory(prev => prev ? { ...prev, newCategory: e.target.value } : null)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEditCategory()}
                        placeholder="Nome da categoria"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setEditingCategory(null)}>Cancelar</Button>
                    <Button onClick={handleEditCategory}>Guardar</Button>
                </div>
            </ResponsiveDialog>
        </div>
    );
}

"use client";

import { FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROFILES, getProfile, type ProfileId } from "@/lib/role-profiles";

/** Escolha do perfil do funcionário (substitui a lista de módulos para os casos normais). */
export function ProfilePicker({ value, onChange }: { value: ProfileId; onChange: (id: ProfileId) => void }) {
  return (
    <FormItem>
      <FormLabel>Perfil</FormLabel>
      <Select value={value} onValueChange={(v) => onChange(v as ProfileId)}>
        <SelectTrigger>
          <SelectValue placeholder="Escolha o perfil" />
        </SelectTrigger>
        <SelectContent>
          {PROFILES.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{getProfile(value).description}</p>
    </FormItem>
  );
}

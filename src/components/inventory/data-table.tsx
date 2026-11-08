
"use client"

import * as React from "react"
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  getFilteredRowModel,
} from "@tanstack/react-table"
import { Virtuoso } from 'react-virtuoso';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Product } from "@/lib/types"
import { Card, CardContent } from "../ui/card"

interface DataTableProps<TData extends Product, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  useVirtualization?: boolean;
}

export function InventoryDataTable<TData extends Product, TValue>({
  columns,
  data,
  useVirtualization = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [isClient, setIsClient] = React.useState(false)

  React.useEffect(() => {
    setIsClient(true)
  }, [])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
    },
  })


  if (!isClient) {
    return null;
  }

  return (
    <Card className="glass-card shadow-sm overflow-hidden border-0 bg-transparent sm:bg-card sm:border">
      <CardContent className="p-0">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto overflow-y-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="px-4 sm:px-8 py-6 text-[11px] font-[800] text-slate-400 uppercase tracking-[0.1em]">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {useVirtualization ? (
                <tr className="p-0 border-0">
                  <td colSpan={columns.length} className="p-0 border-0">
                    <Virtuoso
                      useWindowScroll
                      increaseViewportBy={500}
                      data={table.getRowModel().rows}
                      totalCount={table.getRowModel().rows.length}
                      itemContent={(index, row) => (
                        <div className="flex w-full border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all group">
                          {row.getVisibleCells().map((cell) => (
                            <div
                              key={cell.id}
                              className="px-4 sm:px-8 py-4 flex-shrink-0"
                              style={{ width: cell.column.getSize() }}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          ))}
                        </div>
                      )}
                    />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="dark:border-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all group"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-4 sm:px-8 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      Nenhum resultado.
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden">
          {useVirtualization ? (
            <Virtuoso
              useWindowScroll
              data={table.getRowModel().rows}
              totalCount={table.getRowModel().rows.length}
              itemContent={(index, row) => (
                <div className="pb-4">
                  <div key={row.id} className="bg-card rounded-xl p-4 border shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="mb-1">
                          {flexRender(row.getVisibleCells()[0].column.columnDef.cell, row.getVisibleCells()[0].getContext())}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {flexRender(row.getVisibleCells()[1].column.columnDef.cell, row.getVisibleCells()[1].getContext())}
                          {row.getVisibleCells().find(c => c.column.id === 'location') && (
                            flexRender(row.getVisibleCells().find(c => c.column.id === 'location')!.column.columnDef.cell, row.getVisibleCells().find(c => c.column.id === 'location')!.getContext())
                          )}
                        </div>
                      </div>
                      <div>
                        {flexRender(row.getVisibleCells()[row.getVisibleCells().length - 1].column.columnDef.cell, row.getVisibleCells()[row.getVisibleCells().length - 1].getContext())}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-dashed">
                      <div className="flex flex-col items-center justify-center p-2 bg-muted/30 rounded-lg">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Disponível</span>
                        {flexRender(row.getVisibleCells().find(c => c.column.id === 'stock')!.column.columnDef.cell, row.getVisibleCells().find(c => c.column.id === 'stock')!.getContext())}
                      </div>
                      <div className="flex flex-col items-center justify-center p-2 bg-muted/30 rounded-lg">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Reservado</span>
                        {flexRender(row.getVisibleCells().find(c => c.column.id === 'reservedStock')!.column.columnDef.cell, row.getVisibleCells().find(c => c.column.id === 'reservedStock')!.getContext())}
                      </div>
                      <div className="flex flex-col items-center justify-center p-2 bg-muted/30 rounded-lg">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Estado</span>
                        {flexRender(row.getVisibleCells().find(c => c.column.id === 'lastUpdated')!.column.columnDef.cell, row.getVisibleCells().find(c => c.column.id === 'lastUpdated')!.getContext())}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <div key={row.id} className="bg-card rounded-xl p-4 border shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="mb-1">
                          {flexRender(row.getVisibleCells()[0].column.columnDef.cell, row.getVisibleCells()[0].getContext())}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {flexRender(row.getVisibleCells()[1].column.columnDef.cell, row.getVisibleCells()[1].getContext())}
                          {row.getVisibleCells().find(c => c.column.id === 'location') && (
                            flexRender(row.getVisibleCells().find(c => c.column.id === 'location')!.column.columnDef.cell, row.getVisibleCells().find(c => c.column.id === 'location')!.getContext())
                          )}
                        </div>
                      </div>
                      <div>
                        {flexRender(row.getVisibleCells()[row.getVisibleCells().length - 1].column.columnDef.cell, row.getVisibleCells()[row.getVisibleCells().length - 1].getContext())}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-dashed">
                      <div className="flex flex-col items-center justify-center p-2 bg-muted/30 rounded-lg">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Disponível</span>
                        {flexRender(row.getVisibleCells().find(c => c.column.id === 'stock')!.column.columnDef.cell, row.getVisibleCells().find(c => c.column.id === 'stock')!.getContext())}
                      </div>
                      <div className="flex flex-col items-center justify-center p-2 bg-muted/30 rounded-lg">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Reservado</span>
                        {flexRender(row.getVisibleCells().find(c => c.column.id === 'reservedStock')!.column.columnDef.cell, row.getVisibleCells().find(c => c.column.id === 'reservedStock')!.getContext())}
                      </div>
                      <div className="flex flex-col items-center justify-center p-2 bg-muted/30 rounded-lg">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Estado</span>
                        {flexRender(row.getVisibleCells().find(c => c.column.id === 'lastUpdated')!.column.columnDef.cell, row.getVisibleCells().find(c => c.column.id === 'lastUpdated')!.getContext())}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground bg-card rounded-xl border">
                  Nenhum resultado.
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

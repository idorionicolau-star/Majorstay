import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, CreditCard, Mail, MessageCircle } from 'lucide-react';
import { emailLink, SUPPORT, whatsappLink } from '@/lib/support';

export function SubscriptionExpired() {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-xl">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-slate-100 dark:bg-slate-900 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-slate-500 dark:text-slate-400" />
                    </div>
                    <CardTitle className="text-2xl font-bold font-headline text-slate-900 dark:text-white">
                        Acesso Bloqueado
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 mt-2">
                        O seu período de teste ou assinatura expirou. Para continuar a utilizar o MajorStockX e ter acesso aos seus dados, por favor renove a sua subscrição.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 pb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-lg text-sm">
                        <h4 className="font-semibold flex items-center gap-2 mb-1">
                            <CreditCard className="w-4 h-4" /> Informação de Pagamento
                        </h4>
                        <p>A sua conta e dados estão guardados em segurança. Efetue o pagamento para restaurar o acesso imediato a todas as funcionalidades.</p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => window.location.href = '/billing'}>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pagar subscrição (M-Pesa, e-Mola, cartão)
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                        <a href={whatsappLink('Olá, preciso de ajuda para renovar a minha subscrição MajorStockX.')} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Suporte por WhatsApp ({SUPPORT.whatsappDisplay})
                        </a>
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                        <a href={emailLink('Renovação de Assinatura')}>
                            <Mail className="w-4 h-4 mr-2" />
                            Suporte por email
                        </a>
                    </Button>
                    <Button variant="ghost" className="w-full text-slate-500" onClick={() => window.location.href = '/login'}>
                        Voltar ao Login
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

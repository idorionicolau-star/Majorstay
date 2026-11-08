'use client';

import type { ModulePermission, PermissionLevel } from '@/lib/types';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from 'firebase/auth';
import { shouldHintPassword, signInMethods } from '@/lib/sign-in-methods';
import { collection, doc, writeBatch, getDoc } from 'firebase/firestore';
import { allPermissions } from '@/lib/data';
import type { InventoryCore } from './core';
import { trialEndFrom } from '@/lib/trial';
import { beginRegistration, endRegistration } from '@/lib/registration-guard';
import { discardGuestData } from '@/lib/guest-mode';

export function useAuthActions(core: InventoryCore) {
  const { auth, toast, firestore } = core;





  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      // conta sem empresa (o registo não chegou ao fim): explica o que fazer em vez de só "Sessão terminada"
      if (firestore) {
        const map = await getDoc(doc(firestore, `users/${cred.user.uid}`)).catch(() => null);
        if (map && !map.exists() && !map.metadata.fromCache) {
          await auth.signOut();
          toast({ variant: 'destructive', title: 'O registo não chegou ao fim', description: 'A conta existe mas a empresa não foi criada. Vá a "Registar" e use o mesmo email e senha — o registo continua de onde parou.', duration: 15000 });
          return false;
        }
      }
      return true;
    } catch (error: any) {
      console.error("Firebase Auth login error:", error);
      let message = "Ocorreu um erro ao fazer login.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Email ou senha inválidos. Se já entrou com o Google, toque em \"Entrar com o Google\" — ou em \"Esqueceu a senha?\" para criar uma senha.";
      }
      toast({ variant: 'destructive', title: 'Erro de Login', description: message });
      throw error;
    }
  };


  /** true = entrou; { noCompany: email } = a conta Google ainda não tem empresa (a página leva ao registo); false = falhou. */
  const loginWithGoogle = async (): Promise<boolean | { noCompany: string }> => {
    // enquanto se verifica se a conta tem empresa, a abertura da sessão espera (sem "Sessão terminada" pelo meio)
    beginRegistration();
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      // Verify if the user exists in our users collection
      if (firestore) {
        const userDoc = await getDoc(doc(firestore, `users/${result.user.uid}`));
        if (!userDoc.exists()) {
          // Conta Google sem empresa: em vez de a pôr fora, leva-a a criar a empresa (só falta o nome)
          await auth.signOut();
          return { noCompany: result.user.email || '' };
        }
      }

      // conta sem senha (só Google, ou a senha foi substituída pelo Google): diz uma vez onde criar uma
      const methods = signInMethods(result.user.providerData.map((p) => p.providerId));
      let store: Storage | null = null;
      try { store = window.localStorage; } catch { /* modo privado */ }
      if (shouldHintPassword(result.user.uid, methods, store)) {
        toast({ title: 'Quer entrar também com email e senha?', description: 'Crie uma senha em Configurações → Perfil → Formas de entrar.', duration: 12000 });
      }

      return true;
    } catch (error: any) {
      console.error("Google Auth login error:", error);
      let message = `Ocorreu um erro ao fazer login com o Google: ${error.message || error.code || 'Desconhecido'}`;
      if (error.code === 'auth/popup-closed-by-user') {
        message = "O login foi cancelado pelo utilizador.";
      } else if (error.code === 'auth/operation-not-allowed') {
        message = "O login com Google não está activo nas configurações do sistema.";
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        message = "Já existe uma conta com este email. Faça login manualmente (Email/Senha).";
      } else if (error.code === 'auth/popup-blocked') {
        message = "O pop-up de login foi bloqueado. Por favor, permita pop-ups para este site.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = "Este domínio não está autorizado na Firebase Console para o Google Auth.";
      }
      toast({ variant: 'destructive', title: 'Erro de Login', description: message });
      return false;
    } finally {
      endRegistration();
    }
  };


  const resetPassword = async (email: string): Promise<void> => {
    try {
      const actionCodeSettings = {
        // URL you want to redirect back to. The domain (www.example.com) for this
        // URL must be whitelisted in the Firebase Console.
        url: window.location.origin + '/login',
        // This must be true.
        handleCodeInApp: true,
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      toast({
        title: "E-mail de redefinição enviado",
        description: "Verifique a sua caixa de entrada para redefinir a sua senha.",
      });
    } catch (error: any) {
      console.error("Firebase Auth reset password error:", error);
      let message = "Ocorreu um erro ao enviar o e-mail de redefinição.";
      if (error.code === 'auth/user-not-found') {
        message = "Não encontramos nenhuma conta com este endereço de e-mail.";
      }
      toast({ variant: 'destructive', title: 'Erro', description: message });
      throw error;
    }
  };


  const changePassword = async (currentPass: string, newPass: string): Promise<boolean> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error("Utilizador não autenticado.");
      }

      // Reauthenticate first to satisfy "recent login" requirement
      const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPass);

      toast({
        title: "Senha alterada",
        description: "A sua senha foi alterada com sucesso.",
      });
      return true;
    } catch (error: any) {
      console.error("Firebase Auth change password error:", error);
      let message = "Ocorreu um erro ao alterar a senha.";
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "A senha atual está incorreta.";
      } else if (error.code === 'auth/weak-password') {
        message = "A nova senha tem de ter no mínimo 6 caracteres.";
      } else if (error.code === 'auth/requires-recent-login') {
        message = "Faça logout e login novamente antes de tentar alterar a senha.";
      }
      toast({ variant: 'destructive', title: 'Erro de Autenticação', description: message });
      return false;
    }
  };


  /** true = empresa criada; 'existing' = a conta já tinha empresa (entrou nela); false = falhou (já avisou). */
  const registerCompany = async (companyName: string, adminUsername: string, adminEmail: string, adminPass: string, businessType: 'manufacturer' | 'reseller'): Promise<boolean | 'existing'> => {
    if (!firestore) return false;

    beginRegistration();
    try {
      // Nota: não se verifica se o nome da empresa já existe. Essa pesquisa (listar `companies`) é proibida pelas regras
      // do Firestore para quem ainda não tem conta, e fazia o registo falhar sempre. A empresa é identificada pelo ID, não pelo nome.
      const companiesRef = collection(firestore, 'companies');

      let newUserId: string;
      try {
        const created = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
        newUserId = created.user.uid;
        // Email confirmado = a senha fica mesmo que um dia entre com o Google (sem isso a Firebase troca-a pelo Google)
        auth.languageCode = 'pt';
        sendEmailVerification(created.user, { url: window.location.origin + '/dashboard' }).catch((e) => console.warn('Falha ao enviar a confirmação do email:', e));
      } catch (e: any) {
        if (e?.code !== 'auth/email-already-in-use') throw e;
        // A conta pode ter ficado criada numa tentativa anterior que não chegou ao fim (sem rede a meio):
        // entra com a mesma senha e, se ainda não tem empresa, acaba o registo.
        let existingUid: string;
        try {
          existingUid = (await signInWithEmailAndPassword(auth, adminEmail, adminPass)).user.uid;
        } catch {
          throw Object.assign(new Error('email-taken'), { code: 'msx/email-taken' });
        }
        const existingMap = await getDoc(doc(firestore, `users/${existingUid}`));
        if (existingMap.exists()) return 'existing';
        newUserId = existingUid;
      }

      const newCompanyRef = doc(companiesRef);

      const adminPermissions = allPermissions.reduce((acc, p) => {
        acc[p.id] = 'write';
        return acc;
      }, {} as Record<ModulePermission, PermissionLevel>);

      const employeesCollectionRef = collection(firestore, `companies/${newCompanyRef.id}/employees`);
      const newEmployeeRef = doc(employeesCollectionRef, newUserId);
      const userMapDocRef = doc(firestore, `users/${newUserId}`);

      const batch = writeBatch(firestore);

      batch.set(newEmployeeRef, {
        username: adminUsername,
        email: adminEmail,
        role: 'Admin',
        companyId: newCompanyRef.id,
        permissions: adminPermissions,
      });

      batch.set(userMapDocRef, { companyId: newCompanyRef.id });

      const trialStart = new Date();
      const trialEndsAt = trialEndFrom(trialStart);

      batch.set(newCompanyRef, {
        name: companyName,
        ownerId: newUserId,
        isMultiLocation: false,
        locations: [],
        businessType,
        saleCounter: 0,
        status: 'trial',
        trialEndsAt: trialEndsAt.toISOString(),
        // empresa nova: os dias de teste já começam agora, não há reinício
        trialRestartedAt: trialStart.toISOString()
      });

      await batch.commit();

      try {
        const fbToken = await auth.currentUser?.getIdToken();
        await fetch('/api/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fbToken}`
          },
          body: JSON.stringify({
            to: adminEmail,
            subject: '🎉 Bem-vindo ao MajorStockX!',
            type: 'WELCOME',
            companyName: companyName,
            companyId: newCompanyRef.id,
          }),
        });
      } catch (emailError) {
        console.warn("Falha ao enviar e-mail de boas-vindas, mas o registo foi bem-sucedido:", emailError);
      }

      discardGuestData(); // a conta nova começa vazia: o que se fez como convidado não sobe
      return true;
    } catch (error: any) {
      console.error('Registration error: ', error);
      let message = 'Ocorreu um erro inesperado durante o registo.';
      if (error.code === 'msx/email-taken' || error.code === 'auth/email-already-in-use') {
        message = 'Este email já tem uma conta. Se entrou antes com o Google, toque em "Registar com o Google". Se não, toque em "Faça login" (ou recupere a senha).';
      } else if (error.code === 'auth/weak-password') {
        message = 'A senha tem de ter pelo menos 6 caracteres.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'O email não está bem escrito.';
      } else if (error.code === 'auth/network-request-failed' || error.code === 'unavailable' || /network|offline/i.test(String(error.message))) {
        message = 'A ligação falhou a meio do registo. Tente outra vez com o mesmo email e senha — continua de onde parou.';
      } else if (String(error.message || '').includes('Uma empresa com este nome')) {
        message = error.message;
      }
      toast({ variant: 'destructive', title: 'Erro no Registo', description: message });
      return false;
    } finally {
      endRegistration();
    }
  };


  const registerCompanyWithGoogle = async (companyName: string, businessType: 'manufacturer' | 'reseller'): Promise<boolean> => {
    if (!firestore) return false;

    beginRegistration();
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const newUserId = userCredential.user.uid;
      const adminEmail = userCredential.user.email || '';
      const adminUsername = userCredential.user.displayName || 'Admin';

      // Check if user already has a company
      const existingUserMap = await getDoc(doc(firestore, `users/${newUserId}`));
      if (existingUserMap.exists()) {
        await auth.signOut();
        toast({
          variant: 'destructive',
          title: 'Erro no Registo',
          description: 'Esta conta Google já está associada a uma empresa. Por favor, faça login em vez de se registar.'
        });
        return false;
      }

      // (sem verificação do nome da empresa: ver registerCompany)
      const companiesRef = collection(firestore, 'companies');

      const newCompanyRef = doc(companiesRef);

      const adminPermissions = allPermissions.reduce((acc, p) => {
        acc[p.id] = 'write';
        return acc;
      }, {} as Record<ModulePermission, PermissionLevel>);

      const employeesCollectionRef = collection(firestore, `companies/${newCompanyRef.id}/employees`);
      const newEmployeeRef = doc(employeesCollectionRef, newUserId);
      const userMapDocRef = doc(firestore, `users/${newUserId}`);

      const batch = writeBatch(firestore);

      batch.set(newEmployeeRef, {
        username: adminUsername,
        email: adminEmail,
        role: 'Admin',
        companyId: newCompanyRef.id,
        permissions: adminPermissions,
      });

      batch.set(userMapDocRef, { companyId: newCompanyRef.id });

      const trialStart = new Date();
      const trialEndsAt = trialEndFrom(trialStart);

      batch.set(newCompanyRef, {
        name: companyName,
        ownerId: newUserId,
        isMultiLocation: false,
        locations: [],
        businessType,
        saleCounter: 0,
        status: 'trial',
        trialEndsAt: trialEndsAt.toISOString(),
        // empresa nova: os dias de teste já começam agora, não há reinício
        trialRestartedAt: trialStart.toISOString()
      });

      await batch.commit();

      try {
        const fbToken = await auth.currentUser?.getIdToken();
        await fetch('/api/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fbToken}`
          },
          body: JSON.stringify({
            to: adminEmail,
            subject: '🎉 Bem-vindo ao MajorStockX!',
            type: 'WELCOME',
            companyName: companyName,
            companyId: newCompanyRef.id,
          }),
        });
      } catch (emailError) {
        console.warn("Falha ao enviar e-mail de boas-vindas, mas o registo foi bem-sucedido:", emailError);
      }

      discardGuestData(); // a conta nova começa vazia: o que se fez como convidado não sobe
      return true;
    } catch (error: any) {
      console.error('Registration with Google error: ', error);
      let message = `Erro inesperado: ${error.message || error.code || 'Desconhecido'}`;
      if (error.code === 'auth/popup-closed-by-user') {
        message = 'Registo com Google cancelado.';
      } else if (error.code === 'auth/operation-not-allowed') {
        message = "O login com Google não está activo nas configurações do sistema.";
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        message = "Já existe uma conta com este email. Faça login manualmente (Email/Senha).";
      } else if (error.code === 'auth/popup-blocked') {
        message = "O pop-up de login foi bloqueado. Por favor, permita pop-ups para este site.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = "Este domínio não está autorizado na Firebase Console para o Google Auth.";
      } else if (error.message?.includes('Uma empresa com este nome')) {
        message = error.message;
      }
      toast({ variant: 'destructive', title: 'Erro no Registo', description: message });
      return false;
    } finally {
      endRegistration();
    }
  };
  return { login, loginWithGoogle, resetPassword, changePassword, registerCompany, registerCompanyWithGoogle };
}

export type AuthActions = ReturnType<typeof useAuthActions>;

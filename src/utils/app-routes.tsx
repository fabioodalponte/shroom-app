import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "../app/components/AppLayout";
import { LoginPage } from "../components/auth/LoginPage";
import { SignupPage } from "../components/auth/SignupPage";
import { ProtectedRoute } from "../components/auth/ProtectedRoute";
import { Dashboard } from "../app/pages/Dashboard";
import { Lotes } from "../app/pages/Lotes";
import { LoteDetails } from "../app/pages/LoteDetails";
import { CreateLote } from "../app/pages/CreateLote";
import { Colheita } from "../app/pages/Colheita";
import { Estoque } from "../app/pages/Estoque";
import { Vendas } from "../app/pages/Vendas";
import { Clientes } from "../app/pages/Clientes";
import { Compras } from "../app/pages/Compras";
import { Fornecedores } from "../app/pages/Fornecedores";
import { Logistica } from "../app/pages/LogisticaNova";
import { Motoristas } from "../app/pages/Motoristas";
import { Treinamento } from "../app/pages/Treinamento";
import { Checklists } from "../app/pages/Checklists";
import { Financeiro } from "../app/pages/Financeiro";
import { Perfil } from "../app/pages/Perfil";
import { Seguranca } from "../app/pages/Seguranca";
import { Debug } from "../app/pages/Debug";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/signup",
    Component: SignupPage,
  },
  {
    path: "/app",
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "dashboard",
        Component: Dashboard,
      },
      {
        path: "lotes",
        Component: Lotes,
      },
      {
        path: "lotes/criar",
        Component: CreateLote,
      },
      {
        path: "lotes/:id",
        Component: LoteDetails,
      },
      {
        path: "colheita",
        Component: Colheita,
      },
      {
        path: "estoque",
        Component: Estoque,
      },
      {
        path: "vendas",
        Component: Vendas,
      },
      {
        path: "clientes",
        Component: Clientes,
      },
      {
        path: "compras",
        Component: Compras,
      },
      {
        path: "fornecedores",
        Component: Fornecedores,
      },
      {
        path: "logistica",
        Component: Logistica,
      },
      {
        path: "motoristas",
        Component: Motoristas,
      },
      {
        path: "seguranca",
        Component: Seguranca,
      },
      {
        path: "treinamento",
        Component: Treinamento,
      },
      {
        path: "checklists",
        Component: Checklists,
      },
      {
        path: "financeiro",
        Component: Financeiro,
      },
      {
        path: "perfil",
        Component: Perfil,
      },
      {
        path: "debug",
        Component: Debug,
      },
    ],
  },
]);
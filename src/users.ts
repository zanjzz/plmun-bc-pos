import { apiRequest } from "./api";
import type { Role } from "./auth";

export type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  reference: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserInput = {
  email: string;
  fullName: string;
  role: Role;
  reference: string;
  active?: boolean;
  password?: string;
};

export async function getUsers() {
  return (await apiRequest<{ users: ManagedUser[] }>("/users", {}, true)).users;
}

export async function createUser(input: UserInput & { password: string }) {
  return (
    await apiRequest<{ user: ManagedUser }>(
      "/users",
      { method: "POST", body: JSON.stringify(input) },
      true,
    )
  ).user;
}

export async function updateUser(id: string, input: UserInput) {
  return (
    await apiRequest<{ user: ManagedUser }>(
      `/users/${id}`,
      { method: "PUT", body: JSON.stringify(input) },
      true,
    )
  ).user;
}

export async function removeUser(id: string) {
  return (await apiRequest<{ user: ManagedUser }>(`/users/${id}`, { method: "DELETE" }, true)).user;
}

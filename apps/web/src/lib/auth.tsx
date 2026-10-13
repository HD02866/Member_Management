'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ApiClient } from './api';

export interface UserOrganizationAffiliation {
  id: string;
  name: string;
  slug: string;
  isMember: boolean;
  memberStatus?: string;
  memberNumber?: string;
  isStaff: boolean;
  staffRole?: string;
  permissions?: string[];
  logoUrl?: string | null;
  brandingConfig?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    navbarMode?: 'ORGANIZATION_ONLY' | 'CO_BRANDED' | 'WAANOFII_ONLY';
    featureOverrides?: Record<string, boolean>;
    cardTemplate?: any;
    quotas?: Record<string, number>;
  } | null;
}

export interface UserProfile {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  isPlatformAdmin: boolean;
  status: string;
  createdAt: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  password: string;
  organizationSlug?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  organizations: UserOrganizationAffiliation[];
  activeOrg: UserOrganizationAffiliation | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<{ user: UserProfile | null; organizations: UserOrganizationAffiliation[] }>;
  register: (
    firstName: string,
    lastName: string,
    identifier: string,
    password: string,
    organizationSlug?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => void;
  refreshUser: () => Promise<{ user: UserProfile | null; organizations: UserOrganizationAffiliation[] }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  organizations: [],
  activeOrg: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => ({ user: null, organizations: [] }),
  register: async () => {},
  logout: async () => {},
  switchOrganization: () => {},
  refreshUser: async () => ({ user: null, organizations: [] }),
});

let inFlightRefreshPromise: Promise<{ user: UserProfile | null; organizations: UserOrganizationAffiliation[] }> | null = null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organizations, setOrganizations] = useState<UserOrganizationAffiliation[]>([]);
  const [activeOrg, setActiveOrg] = useState<UserOrganizationAffiliation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    if (inFlightRefreshPromise) {
      return inFlightRefreshPromise;
    }

    inFlightRefreshPromise = (async () => {
      try {
        // 1. Fetch user affiliations
        const profile = await ApiClient.get<UserProfile>('/auth/me');
        setUser(profile);

        // 2. Fetch user's affiliated organizations
        let orgs: UserOrganizationAffiliation[] = [];
        try {
          const fetchedOrgs = await ApiClient.get<UserOrganizationAffiliation[]>('/me/organizations');
          orgs = fetchedOrgs || [];
          setOrganizations(orgs);

          // Retain or select 4Baye tenant
          const fourBOrg = orgs.find((o) => o.slug === '4b');
          const savedTenantId = ApiClient.getActiveTenantId();
          const found = fourBOrg || orgs.find((o) => o.id === savedTenantId);
          if (found) {
            setActiveOrg(found);
            ApiClient.setActiveTenantId(found.id);
          } else if (orgs.length > 0) {
            setActiveOrg(orgs[0]);
            ApiClient.setActiveTenantId(orgs[0].id);
          } else {
            try {
              const public4B = await ApiClient.get<any>('/organizations/4b');
              if (public4B?.id) {
                const affiliation: UserOrganizationAffiliation = {
                  id: public4B.id,
                  name: public4B.name || '4Baye Association',
                  slug: '4b',
                  isMember: false,
                  isStaff: false,
                  logoUrl: public4B.logoUrl || null,
                  brandingConfig: public4B.profile?.brandingConfig || null,
                };
                setActiveOrg(affiliation);
                ApiClient.setActiveTenantId(public4B.id);
              } else {
                setActiveOrg(null);
                ApiClient.setActiveTenantId(null);
              }
            } catch {
              setActiveOrg(null);
              ApiClient.setActiveTenantId(null);
            }
          }
        } catch {
          setOrganizations([]);
        }
        return { user: profile, organizations: orgs };
      } catch {
        setUser(null);
        setOrganizations([]);
        setActiveOrg(null);
        ApiClient.setAccessToken(null);
        return { user: null, organizations: [] };
      } finally {
        setIsLoading(false);
        inFlightRefreshPromise = null;
      }
    })();

    return inFlightRefreshPromise;
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (identifier: string, password: string) => {
    const res = await ApiClient.post<{ tokens: { accessToken: string }; user: UserProfile }>(
      '/auth/login',
      {
        identifier: identifier.trim(),
        password,
      },
    );

    if (res?.tokens?.accessToken) {
      ApiClient.setAccessToken(res.tokens.accessToken);
    }
    return await refreshUser();
  };

  const register = async (
    firstName: string,
    lastName: string,
    identifier: string,
    password: string,
    organizationSlug?: string,
  ) => {
    const cleanId = identifier.trim();
    const isEmail = cleanId.includes('@');

    const payload: RegisterPayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
    };
    if (isEmail) {
      payload.email = cleanId.toLowerCase();
    } else {
      payload.phoneNumber = cleanId;
    }
    if (organizationSlug?.trim()) {
      payload.organizationSlug = organizationSlug.trim();
    }

    const res = await ApiClient.post<{ tokens: { accessToken: string }; user: UserProfile }>(
      '/auth/register',
      payload,
    );

    if (res?.tokens?.accessToken) {
      ApiClient.setAccessToken(res.tokens.accessToken);
    }
    await refreshUser();
  };

  const logout = async () => {
    try {
      await ApiClient.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      ApiClient.setAccessToken(null);
      ApiClient.setActiveTenantId(null);
      setUser(null);
      setOrganizations([]);
      setActiveOrg(null);
      window.location.href = '/login';
    }
  };

  const switchOrganization = (orgId: string) => {
    const match = organizations.find((o) => o.id === orgId);
    if (match) {
      setActiveOrg(match);
      ApiClient.setActiveTenantId(match.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        activeOrg,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchOrganization,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

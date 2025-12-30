import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../plugins/auth.plugin";
import type { AuthContext } from "../types/auth.types";

export const catalogRoutes = new Elysia({ prefix: "/catalogs", tags: ["Catalogs"] })
  .use(requireAuth)

  // ============================================
  // SERVICE CATALOG
  // ============================================

  // Get all service catalog items for vendor
  .get(
    "/services",
    async ({ user }) => {
      const items = await prisma.serviceCatalog.findMany({
        where: { vendorId: user!.vendorId! },
        orderBy: { name: "asc" },
      });

      return { success: true, data: items };
    },
    {
      detail: {
        summary: "List service catalog",
        description: "Get all service catalog items for the authenticated vendor",
      },
    }
  )

  // Create service catalog item
  .post(
    "/services",
    async ({ body, user }) => {
      const item = await prisma.serviceCatalog.create({
        data: {
          vendorId: user!.vendorId!,
          name: body.name,
        },
      });

      return { success: true, data: item };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: "Create service catalog item",
        description: "Add a new service to the catalog",
      },
    }
  )

  // Update service catalog item
  .put(
    "/services/:id",
    async ({ params, body, user, set }) => {
      // Verify ownership
      const existing = await prisma.serviceCatalog.findFirst({
        where: { id: params.id, vendorId: user!.vendorId! },
      });

      if (!existing) {
        set.status = 404;
        return { success: false, error: "Item not found" };
      }

      const item = await prisma.serviceCatalog.update({
        where: { id: params.id },
        data: {
          name: body.name,
        },
      });

      return { success: true, data: item };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: "Update service catalog item",
      },
    }
  )

  // Delete service catalog item
  .delete(
    "/services/:id",
    async ({ params, user, set }) => {
      const existing = await prisma.serviceCatalog.findFirst({
        where: { id: params.id, vendorId: user!.vendorId! },
      });

      if (!existing) {
        set.status = 404;
        return { success: false, error: "Item not found" };
      }

      await prisma.serviceCatalog.delete({ where: { id: params.id } });

      return { success: true, message: "Item deleted" };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Delete service catalog item",
      },
    }
  )

  // ============================================
  // JOB DESCRIPTION CATALOG
  // ============================================

  // Get all job descriptions for vendor
  .get(
    "/job-descriptions",
    async ({ user }) => {
      const items = await prisma.jobDescriptionCatalog.findMany({
        where: { vendorId: user!.vendorId! },
        orderBy: { title: "asc" },
      });

      return { success: true, data: items };
    },
    {
      detail: {
        summary: "List job description catalog",
      },
    }
  )

  // Create job description
  .post(
    "/job-descriptions",
    async ({ body, user }) => {
      const item = await prisma.jobDescriptionCatalog.create({
        data: {
          vendorId: user!.vendorId!,
          title: body.title,
          price: body.price,
        },
      });

      return { success: true, data: item };
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        price: t.Optional(t.Number({ minimum: 0 })),
      }),
      detail: {
        summary: "Create job description",
      },
    }
  )

  // Update job description
  .put(
    "/job-descriptions/:id",
    async ({ params, body, user, set }) => {
      const existing = await prisma.jobDescriptionCatalog.findFirst({
        where: { id: params.id, vendorId: user!.vendorId! },
      });

      if (!existing) {
        set.status = 404;
        return { success: false, error: "Item not found" };
      }

      const item = await prisma.jobDescriptionCatalog.update({
        where: { id: params.id },
        data: {
          title: body.title,
          price: body.price,
        },
      });

      return { success: true, data: item };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.String({ minLength: 1 }),
        price: t.Optional(t.Number({ minimum: 0 })),
      }),
      detail: {
        summary: "Update job description",
      },
    }
  )

  // Delete job description
  .delete(
    "/job-descriptions/:id",
    async ({ params, user, set }) => {
      const existing = await prisma.jobDescriptionCatalog.findFirst({
        where: { id: params.id, vendorId: user!.vendorId! },
      });

      if (!existing) {
        set.status = 404;
        return { success: false, error: "Item not found" };
      }

      await prisma.jobDescriptionCatalog.delete({ where: { id: params.id } });

      return { success: true, message: "Item deleted" };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Delete job description",
      },
    }
  );

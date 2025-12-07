import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authPlugin } from "../plugins/auth.plugin";

export const settingsRoutes = new Elysia({ prefix: "/settings", tags: ["Settings"] })
    .use(authPlugin)

    // Get current user's vendor settings
    .get(
        "/",
        async (ctx) => {
            const { user, set, request, jwt } = ctx;

            console.log("Settings GET - user:", user);

            // DEBUG: Check what's happening
            if (!user || !user.id) {
                const authHeader = request.headers.get("authorization");
                let verifyResult = "No token";
                if (authHeader && authHeader.startsWith("Bearer ")) {
                    const token = authHeader.substring(7);
                    const payload = await jwt.verify(token);
                    verifyResult = payload ? JSON.stringify(payload) : "Verification failed";
                }

                console.log("Auth Debug:", { authHeader, verifyResult, user });

                set.status = 401;
                return {
                    success: false,
                    error: "Unauthorized (Debug)",
                    debug: {
                        authHeader,
                        verifyResult,
                        user
                    }
                };
            }

            try {
                // Get the user's vendor
                const userData = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: {
                        vendor: {
                            include: {
                                vatConfig: true,
                            },
                        },
                    },
                });

                console.log("Settings GET - userData:", userData?.id, "vendor:", userData?.vendor?.id);

                // If user has no vendor, return null vendor (allow them to create one)
                if (!userData?.vendor) {
                    return {
                        success: true,
                        data: {
                            vendor: null,
                            vatConfig: {
                                vatRate: 7,
                                whtRate: 1,
                                calculateBeforeVat: false,
                            },
                        },
                    };
                }

                return {
                    success: true,
                    data: {
                        vendor: {
                            id: userData.vendor.id,
                            companyName: userData.vendor.companyName,
                            companyAddress: userData.vendor.companyAddress,
                            taxId: userData.vendor.taxId,
                            bankAccount: userData.vendor.bankAccount,
                            bankName: userData.vendor.bankName,
                            bankBranch: userData.vendor.bankBranch,
                        },
                        vatConfig: userData.vendor.vatConfig || {
                            vatRate: 7,
                            whtRate: 1,
                            calculateBeforeVat: false,
                        },
                    },
                };
            } catch (error) {
                console.error("Settings GET error:", error);
                set.status = 500;
                return { success: false, error: "Internal server error" };
            }
        },
        {
            detail: {
                summary: "Get settings",
                description: "Get vendor and VAT config settings",
            },
        }
    )

    // Create new vendor (for users without a vendor)
    .post(
        "/vendor",
        async (ctx) => {
            const { user, body, set } = ctx;

            if (!user?.id) {
                set.status = 401;
                return { success: false, error: "Unauthorized" };
            }

            try {
                const userData = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: { vendor: true },
                });

                // If user already has a vendor, return error
                if (userData?.vendor) {
                    set.status = 400;
                    return { success: false, error: "User already has a vendor. Use PUT to update." };
                }

                // Check if taxId already exists
                const existingVendor = await prisma.vendor.findUnique({
                    where: { taxId: body.taxId },
                });

                if (existingVendor) {
                    set.status = 400;
                    return { success: false, error: "เลขประจำตัวผู้เสียภาษีนี้มีอยู่ในระบบแล้ว" };
                }

                // Create new vendor and link to user
                const newVendor = await prisma.vendor.create({
                    data: {
                        companyName: body.companyName,
                        companyAddress: body.companyAddress,
                        taxId: body.taxId,
                        bankAccount: body.bankAccount,
                        bankName: body.bankName,
                        bankBranch: body.bankBranch,
                        users: {
                            connect: { id: user.id },
                        },
                    },
                });

                return { success: true, data: newVendor };
            } catch (error) {
                console.error("Vendor POST error:", error);
                set.status = 500;
                return { success: false, error: "Internal server error" };
            }
        },
        {
            body: t.Object({
                companyName: t.String(),
                companyAddress: t.String(),
                taxId: t.String(),
                bankAccount: t.String(),
                bankName: t.String(),
                bankBranch: t.String(),
            }),
            detail: {
                summary: "Create vendor",
                description: "Create new vendor for user",
            },
        }
    )

    // Update vendor settings
    .put(
        "/vendor",
        async (ctx) => {
            const { user, body, set } = ctx;

            if (!user?.id) {
                set.status = 401;
                return { success: false, error: "Unauthorized" };
            }

            try {
                const userData = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: { vendor: true },
                });

                if (!userData?.vendor) {
                    set.status = 404;
                    return { success: false, error: "No vendor associated with user. Use POST to create." };
                }

                const updatedVendor = await prisma.vendor.update({
                    where: { id: userData.vendor.id },
                    data: {
                        companyName: body.companyName,
                        companyAddress: body.companyAddress,
                        taxId: body.taxId,
                        bankAccount: body.bankAccount,
                        bankName: body.bankName,
                        bankBranch: body.bankBranch,
                    },
                });

                return { success: true, data: updatedVendor };
            } catch (error) {
                console.error("Vendor PUT error:", error);
                set.status = 500;
                return { success: false, error: "Internal server error" };
            }
        },
        {
            body: t.Object({
                companyName: t.String(),
                companyAddress: t.String(),
                taxId: t.String(),
                bankAccount: t.String(),
                bankName: t.String(),
                bankBranch: t.String(),
            }),
            detail: {
                summary: "Update vendor",
                description: "Update vendor company info",
            },
        }
    )

    // Update VAT config
    .put(
        "/vat-config",
        async (ctx) => {
            const { user, body, set } = ctx;

            if (!user?.id) {
                set.status = 401;
                return { success: false, error: "Unauthorized" };
            }

            try {
                const userData = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: { vendor: true },
                });

                if (!userData?.vendor) {
                    set.status = 404;
                    return { success: false, error: "No vendor associated with user" };
                }

                // Upsert VAT config
                const vatConfig = await prisma.vatConfigByVendor.upsert({
                    where: { vendorId: userData.vendor.id },
                    update: {
                        vatRate: body.vatRate,
                        whtRate: body.whtRate,
                        calculateBeforeVat: body.calculateBeforeVat,
                    },
                    create: {
                        vendorId: userData.vendor.id,
                        vatRate: body.vatRate,
                        whtRate: body.whtRate,
                        calculateBeforeVat: body.calculateBeforeVat,
                    },
                });

                return { success: true, data: vatConfig };
            } catch (error) {
                console.error("VatConfig PUT error:", error);
                set.status = 500;
                return { success: false, error: "Internal server error" };
            }
        },
        {
            body: t.Object({
                vatRate: t.Number({ minimum: 0, maximum: 100 }),
                whtRate: t.Number({ minimum: 0, maximum: 100 }),
                calculateBeforeVat: t.Boolean(),
            }),
            detail: {
                summary: "Update VAT config",
                description: "Update VAT and WHT rates",
            },
        }
    )

    // Get company settings (Admin company - the payer)
    .get(
        "/company",
        async (ctx) => {
            const { user, set } = ctx;

            if (!user?.id) {
                set.status = 401;
                return { success: false, error: "Unauthorized" };
            }

            try {
                // Get the first (and should be only) company settings
                const companySettings = await prisma.companySettings.findFirst();

                return {
                    success: true,
                    data: companySettings,
                };
            } catch (error) {
                console.error("Company Settings GET error:", error);
                set.status = 500;
                return { success: false, error: "Internal server error" };
            }
        },
        {
            detail: {
                summary: "Get company settings",
                description: "Get admin company settings (the payer company)",
            },
        }
    )

    // Update company settings (Admin only)
    .put(
        "/company",
        async (ctx) => {
            const { user, body, set } = ctx;

            if (!user?.id) {
                set.status = 401;
                return { success: false, error: "Unauthorized" };
            }

            try {
                // Check if user is admin
                const userData = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: { role: true },
                });

                if (userData?.role?.name !== "ADMIN") {
                    set.status = 403;
                    return { success: false, error: "Only admin can update company settings" };
                }

                // Get existing settings
                const existingSettings = await prisma.companySettings.findFirst();

                let companySettings;
                if (existingSettings) {
                    // Update existing
                    companySettings = await prisma.companySettings.update({
                        where: { id: existingSettings.id },
                        data: {
                            companyName: body.companyName,
                            companyAddress: body.companyAddress,
                            taxId: body.taxId,
                            phone: body.phone,
                            email: body.email,
                            logoUrl: body.logoUrl,
                        },
                    });
                } else {
                    // Create new
                    companySettings = await prisma.companySettings.create({
                        data: {
                            companyName: body.companyName,
                            companyAddress: body.companyAddress,
                            taxId: body.taxId,
                            phone: body.phone,
                            email: body.email,
                            logoUrl: body.logoUrl,
                        },
                    });
                }

                return { success: true, data: companySettings };
            } catch (error) {
                console.error("Company Settings PUT error:", error);
                set.status = 500;
                return { success: false, error: "Internal server error" };
            }
        },
        {
            body: t.Object({
                companyName: t.String(),
                companyAddress: t.String(),
                taxId: t.String(),
                phone: t.Optional(t.String()),
                email: t.Optional(t.String()),
                logoUrl: t.Optional(t.String()),
            }),
            detail: {
                summary: "Update company settings",
                description: "Update admin company settings (payer company)",
            },
        }
    );

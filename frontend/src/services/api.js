import { supabase } from './supabaseClient';

// ============================================
// Helper: wrap Supabase responses to match axios { data } shape
// ============================================
function wrap(promise) {
    return promise.then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return { data };
    });
}

// For RPC calls
function wrapRpc(promise) {
    return promise.then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return { data };
    });
}

// Escape special characters for PostgREST ilike/or filters
function escapeSearch(str) {
    if (!str) return str;
    return str.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '').replace(/\./g, '');
}

// Categories
export const categoriesApi = {
    getAll: () => wrap(
        supabase.from('categories')
            .select('id, name, is_checkout_allowed, is_consumable, created_at, updated_at')
            .order('name')
    ),
    getById: (id) => wrap(
        supabase.from('categories').select('*').eq('id', id).single()
    ).then(async (res) => {
        const { data: subs } = await supabase.from('subcategories')
            .select('id, name').eq('category_id', id).order('name');
        return { data: { ...res.data, subcategories: subs || [] } };
    }),
    create: (data) => wrap(
        supabase.from('categories').insert(data).select().single()
    ),
    update: (id, data) => wrap(
        supabase.from('categories').update(data).eq('id', id).select().single()
    ),
};

// Subcategories
export const subcategoriesApi = {
    getAll: (categoryId) => {
        let query = supabase.from('subcategories')
            .select('id, name, category_id, categories(name)')
            .order('name');
        if (categoryId) query = query.eq('category_id', categoryId);
        return wrap(query).then(res => ({
            data: (res.data || []).map(s => ({
                ...s,
                category_name: s.categories?.name,
                categories: undefined
            }))
        }));
    },
    getById: (id) => wrap(
        supabase.from('subcategories')
            .select('*, categories(name)')
            .eq('id', id).single()
    ).then(res => ({
        data: { ...res.data, category_name: res.data.categories?.name, categories: undefined }
    })),
    create: (data) => wrap(
        supabase.from('subcategories').insert(data).select().single()
    ),
    update: (id, data) => wrap(
        supabase.from('subcategories').update({ name: data.name }).eq('id', id).select().single()
    ),
};

// Locations
export const locationsApi = {
    getAll: (activeOnly = true) => {
        let query = supabase.from('locations').select('*').order('name');
        if (activeOnly) query = query.eq('is_active', true);
        return wrap(query);
    },
    getById: (id) => wrap(
        supabase.from('locations').select('*').eq('id', id).single()
    ),
    create: (data) => wrap(
        supabase.from('locations').insert(data).select().single()
    ),
    update: (id, data) => wrap(
        supabase.from('locations').update(data).eq('id', id).select().single()
    ),
};

// Personnel
export const personnelApi = {
    getAll: (activeOnly = true, search = '') => {
        let query = supabase.from('personnel').select('*').order('full_name');
        if (activeOnly) query = query.eq('is_active', true);
        if (search) query = query.or(`full_name.ilike.%${escapeSearch(search)}%,employee_id.ilike.%${escapeSearch(search)}%,email.ilike.%${escapeSearch(search)}%`);
        return wrap(query);
    },
    getById: (id) => wrap(
        supabase.from('personnel').select('*').eq('id', id).single()
    ),
    create: (data) => wrap(
        supabase.from('personnel').insert(data).select().single()
    ),
    update: (id, data) => wrap(
        supabase.from('personnel').update(data).eq('id', id).select().single()
    ),
};

// Equipment
export const equipmentApi = {
    getAll: (params = {}) => {
        const { status, category_id, subcategory_id, search, is_consumable } = params;
        let query = supabase.from('equipment')
            .select(`
                id, equipment_id, equipment_name, description,
                category_id, categories(name, is_checkout_allowed, is_consumable),
                subcategory_id, subcategories(name),
                is_serialised, serial_number,
                is_quantity_tracked, total_quantity, available_quantity, unit, reorder_level,
                status, current_location_id, locations(name),
                current_holder_id, personnel(full_name, employee_id),
                last_action, last_action_timestamp,
                notes, created_at, updated_at, manufacturer, model
            `)
            .order('equipment_name');
        if (status) query = query.eq('status', status);
        if (category_id) query = query.eq('category_id', category_id);
        if (subcategory_id) query = query.eq('subcategory_id', subcategory_id);
        if (search) {
            const s = escapeSearch(search);
            query = query.or(`equipment_id.ilike.%${s}%,equipment_name.ilike.%${s}%,serial_number.ilike.%${s}%,description.ilike.%${s}%`);
        }
        return wrap(query).then(res => ({
            data: (res.data || []).filter(e => {
                if (is_consumable === 'true' && !e.categories?.is_consumable) return false;
                if (is_consumable === 'false' && e.categories?.is_consumable) return false;
                return true;
            }).map(e => ({
                ...e,
                category_name: e.categories?.name,
                is_checkout_allowed: e.categories?.is_checkout_allowed,
                is_consumable: e.categories?.is_consumable,
                subcategory_name: e.subcategories?.name,
                current_location: e.locations?.name,
                current_holder: e.personnel?.full_name,
                holder_employee_id: e.personnel?.employee_id,
                categories: undefined, subcategories: undefined,
                locations: undefined, personnel: undefined,
            }))
        }));
    },

    getById: (id) => wrap(
        supabase.from('equipment')
            .select(`*, categories(name, is_checkout_allowed, is_consumable), subcategories(name), locations(name), personnel(full_name, employee_id, email)`)
            .eq('id', id).single()
    ).then(res => {
        const e = res.data;
        return { data: { ...e,
            category_name: e.categories?.name, is_checkout_allowed: e.categories?.is_checkout_allowed,
            is_consumable: e.categories?.is_consumable, subcategory_name: e.subcategories?.name,
            current_location: e.locations?.name, current_holder: e.personnel?.full_name,
            holder_employee_id: e.personnel?.employee_id, holder_email: e.personnel?.email,
            categories: undefined, subcategories: undefined, locations: undefined, personnel: undefined,
        }};
    }),

    getByCode: (equipmentId) => wrap(
        supabase.from('equipment')
            .select(`*, categories(name, is_checkout_allowed, is_consumable), subcategories(name), locations(name), personnel(full_name, employee_id)`)
            .eq('equipment_id', equipmentId).single()
    ).then(res => {
        const e = res.data;
        return { data: { ...e,
            category_name: e.categories?.name, is_checkout_allowed: e.categories?.is_checkout_allowed,
            is_consumable: e.categories?.is_consumable, subcategory_name: e.subcategories?.name,
            current_location: e.locations?.name, current_holder: e.personnel?.full_name,
            holder_employee_id: e.personnel?.employee_id,
            categories: undefined, subcategories: undefined, locations: undefined, personnel: undefined,
        }};
    }),

    checkSerial: (serialNumber) => wrap(
        supabase.from('equipment')
            .select('id, equipment_id, equipment_name, serial_number, categories(name), subcategories(name), status')
            .ilike('serial_number', serialNumber)
            .limit(1)
    ).then(res => ({
        data: (res.data || []).map(e => ({
            ...e,
            category_name: e.categories?.name,
            subcategory_name: e.subcategories?.name,
            categories: undefined, subcategories: undefined,
        }))
    })),

    create: (data) => wrap(
        supabase.from('equipment').insert({
            ...data, status: 'Available', available_quantity: data.total_quantity || 1,
        }).select().single()
    ),
    update: (id, data) => wrap(
        supabase.from('equipment').update(data).eq('id', id).select().single()
    ),

    getHistory: (id, limit = 50) => wrap(
        supabase.from('equipment_movements')
            .select(`id, action, quantity, notes, photo_url, created_at, created_by, expected_checkout_date, expected_return_date, locations(name), personnel(full_name, employee_id)`)
            .eq('equipment_id', id)
            .order('created_at', { ascending: false })
            .limit(limit)
    ).then(res => ({
        data: (res.data || []).map(m => ({
            ...m, location: m.locations?.name, personnel: m.personnel?.full_name,
            personnel_employee_id: m.personnel?.employee_id, locations: undefined,
        }))
    })),

    bulkImport: async (rows) => {
        // Fetch lookup tables for name-to-id resolution
        const [catRes, subRes, locRes] = await Promise.all([
            wrap(supabase.from('categories').select('id, name')),
            wrap(supabase.from('subcategories').select('id, name, category_id')),
            wrap(supabase.from('locations').select('id, name').eq('is_active', true)),
        ]);
        const cats = catRes.data || [];
        const subs = subRes.data || [];
        const locs = locRes.data || [];

        const results = { success: [], errors: [] };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // Excel row (1-indexed + header)
            try {
                // Validate required fields
                if (!row.equipment_id?.trim()) throw new Error('Equipment ID is required');
                if (!row.equipment_name?.trim()) throw new Error('Equipment Name is required');
                if (!row.category?.trim()) throw new Error('Category is required');
                if (!row.subcategory?.trim()) throw new Error('Subcategory is required');
                if (!row.location?.trim()) throw new Error('Location is required');

                // Resolve category
                const cat = cats.find(c => c.name.toLowerCase() === row.category.trim().toLowerCase());
                if (!cat) throw new Error(`Category "${row.category}" not found`);

                // Resolve subcategory
                const sub = subs.find(s => s.name.toLowerCase() === row.subcategory.trim().toLowerCase() && s.category_id === cat.id);
                if (!sub) throw new Error(`Subcategory "${row.subcategory}" not found under "${row.category}"`);

                // Resolve location
                const loc = locs.find(l => l.name.toLowerCase() === row.location.trim().toLowerCase());
                if (!loc) throw new Error(`Location "${row.location}" not found`);

                // Insert equipment
                const insertData = {
                    equipment_id: row.equipment_id.trim(),
                    equipment_name: row.equipment_name.trim(),
                    category_id: cat.id,
                    subcategory_id: sub.id,
                    current_location_id: loc.id,
                    manufacturer: row.manufacturer?.trim() || null,
                    model: row.model?.trim() || null,
                    serial_number: row.serial_number?.trim() || null,
                    description: row.description?.trim() || null,
                    notes: row.notes?.trim() || null,
                    is_serialised: !!row.serial_number?.trim(),
                    status: 'Available',
                    available_quantity: 1,
                    total_quantity: 1,
                };

                const { data, error } = await supabase.from('equipment').insert(insertData).select().single();
                if (error) {
                    if (error.message?.includes('duplicate') || error.code === '23505') {
                        throw new Error(`Duplicate equipment ID or serial number`);
                    }
                    throw new Error(error.message);
                }
                results.success.push({ row: rowNum, equipment_id: insertData.equipment_id, name: insertData.equipment_name });
            } catch (err) {
                results.errors.push({ row: rowNum, equipment_id: row.equipment_id || '(empty)', error: err.message });
            }
        }
        return results;
    },
};

// Movements
export const movementsApi = {
    getAll: (params = {}) => {
        const { equipment_id, action, personnel_id, location_id, from_date, to_date, limit = 100 } = params;
        let query = supabase.from('equipment_movements')
            .select(`
                id, equipment_id, action, quantity, location_id, customer_id,
                personnel_id, photo_url, notes, created_at, created_by,
                expected_checkout_date, expected_return_date,
                equipment(equipment_id, equipment_name),
                locations(name), customers(display_name),
                personnel(full_name, employee_id)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (equipment_id) query = query.eq('equipment_id', equipment_id);
        if (action) query = query.eq('action', action);
        if (personnel_id) query = query.eq('personnel_id', personnel_id);
        if (location_id) query = query.eq('location_id', location_id);
        if (from_date) query = query.gte('created_at', from_date);
        if (to_date) query = query.lte('created_at', to_date);
        return wrap(query).then(res => ({
            data: (res.data || []).map(m => ({
                ...m,
                equipment_pk: m.equipment_id,
                equipment_code: m.equipment?.equipment_id,
                equipment_name: m.equipment?.equipment_name,
                location: m.locations?.name,
                customer_name: m.customers?.display_name,
                personnel_name: m.personnel?.full_name,
                personnel_employee_id: m.personnel?.employee_id,
                equipment: undefined, locations: undefined, customers: undefined,
            }))
        }));
    },

    create: (data, photoFile) => {
        const rpcCall = wrapRpc(
            supabase.rpc('create_movement', {
                p_equipment_id: parseInt(data.equipment_id),
                p_action: data.action,
                p_quantity: parseInt(data.quantity) || 1,
                p_location_id: data.location_id ? parseInt(data.location_id) : null,
                p_customer_id: data.customer_id ? parseInt(data.customer_id) : null,
                p_personnel_id: data.personnel_id ? parseInt(data.personnel_id) : null,
                p_notes: data.notes || null,
                p_created_by: data.created_by || null,
                p_is_transfer: data.is_transfer || false,
                p_expected_checkout_date: data.expected_checkout_date || null,
                p_expected_return_date: data.expected_return_date || null,
            })
        );
        if (photoFile) {
            return rpcCall.then(async (result) => {
                const movementId = result.data?.movement?.id || result.data?.id;
                if (movementId) {
                    const fileName = `movement_${movementId}.jpg`;
                    const { error: uploadError } = await supabase.storage.from('movement-photos')
                        .upload(fileName, photoFile, { contentType: photoFile.type, upsert: true });
                    if (!uploadError) {
                        const { data: urlData } = supabase.storage.from('movement-photos').getPublicUrl(fileName);
                        if (urlData?.publicUrl) {
                            await supabase.from('equipment_movements')
                                .update({ photo_url: urlData.publicUrl })
                                .eq('id', movementId);
                        }
                    }
                }
                return result;
            });
        }
        return rpcCall;
    },

    handover: (data) => wrapRpc(
        supabase.rpc('create_handover', {
            p_equipment_id: parseInt(data.equipment_id),
            p_return_location_id: parseInt(data.return_location_id),
            p_new_personnel_id: parseInt(data.new_personnel_id),
            p_new_location_id: parseInt(data.new_location_id),
            p_notes: data.notes || null,
            p_created_by: data.created_by || null,
        })
    ),

    getPhotoUrl: (movementId) => {
        const { data } = supabase.storage.from('movement-photos').getPublicUrl(`movement_${movementId}.jpg`);
        return data?.publicUrl || '';
    },
};

// Reports
export const reportsApi = {
    getDashboard: () => wrapRpc(supabase.rpc('get_dashboard', { p_overdue_days: 14 })),
    getCheckedOut: () => wrapRpc(supabase.rpc('get_checked_out_report', { p_overdue_days: 14 })),
    getOverdue: () => wrapRpc(supabase.rpc('get_overdue_report', { p_overdue_days: 14 })),
    getAvailable: (categoryId) => wrapRpc(
        supabase.rpc('get_available_report', { p_category_id: categoryId ? parseInt(categoryId) : null })
    ),
    getLowStock: () => wrap(
        supabase.from('equipment')
            .select(`id, equipment_id, equipment_name, categories!inner(name, is_consumable), subcategories(name), available_quantity, total_quantity, reorder_level, unit, locations(name)`)
            .eq('categories.is_consumable', true)
    ).then(res => ({
        data: (res.data || [])
            .filter(e => e.available_quantity <= e.reorder_level)
            .map(e => ({ ...e,
                category: e.categories?.name, subcategory: e.subcategories?.name,
                current_location: e.locations?.name,
                categories: undefined, subcategories: undefined, locations: undefined,
            }))
    })),
    getConsumables: () => wrap(
        supabase.from('equipment')
            .select(`id, equipment_id, equipment_name, categories!inner(name, is_consumable), subcategories(name), available_quantity, total_quantity, reorder_level, unit, locations(name)`)
            .eq('categories.is_consumable', true)
            .order('equipment_name')
    ).then(res => ({
        data: (res.data || []).map(e => ({ ...e,
            category: e.categories?.name, subcategory: e.subcategories?.name,
            current_location: e.locations?.name, is_low_stock: e.available_quantity <= e.reorder_level,
            categories: undefined, subcategories: undefined, locations: undefined,
        }))
    })),
    getByCategory: () => wrap(
        supabase.from('categories').select(`id, name, is_checkout_allowed, is_consumable, equipment(id, status)`).order('name')
    ).then(res => ({
        data: (res.data || []).map(c => ({
            category_id: c.id, category: c.name, is_checkout_allowed: c.is_checkout_allowed,
            is_consumable: c.is_consumable, total_items: c.equipment?.length || 0,
            available: c.equipment?.filter(e => e.status === 'Available').length || 0,
            checked_out: c.equipment?.filter(e => e.status === 'Checked Out').length || 0,
            equipment: undefined,
        }))
    })),
    getByLocation: () => wrap(
        supabase.from('locations').select(`id, name, equipment(id, status)`).eq('is_active', true).order('name')
    ).then(res => ({
        data: (res.data || []).map(l => ({
            location_id: l.id, location: l.name, total_items: l.equipment?.length || 0,
            available: l.equipment?.filter(e => e.status === 'Available').length || 0,
            checked_out: l.equipment?.filter(e => e.status === 'Checked Out').length || 0,
            equipment: undefined,
        }))
    })),
    getMovementHistory: (params = {}) => {
        const { from_date, to_date, action, personnel_id, limit = 500 } = params;
        let query = supabase.from('equipment_movements')
            .select(`id, action, quantity, notes, created_at, created_by,
                equipment(equipment_id, equipment_name, categories(name)),
                locations(name), personnel(full_name, employee_id)`)
            .order('created_at', { ascending: false }).limit(limit);
        if (from_date) query = query.gte('created_at', from_date);
        if (to_date) query = query.lte('created_at', to_date);
        if (action) query = query.eq('action', action);
        if (personnel_id) query = query.eq('personnel_id', personnel_id);
        return wrap(query).then(res => ({
            data: (res.data || []).map(m => ({ ...m,
                equipment_id: m.equipment?.equipment_id, equipment_name: m.equipment?.equipment_name,
                category: m.equipment?.categories?.name, location: m.locations?.name,
                personnel_name: m.personnel?.full_name, personnel_employee_id: m.personnel?.employee_id,
                equipment: undefined, locations: undefined,
            }))
        }));
    },
    getUsageStats: (params = {}) => wrapRpc(
        supabase.rpc('get_usage_stats', { p_from_date: params.from_date || null, p_to_date: params.to_date || null })
    ),

    // Asset reports
    getVehicleReport: () => wrap(
        supabase.from('vehicles').select('*').order('make')
    ).then(res => ({ data: res.data || [] })),

    getCellphoneReport: () => wrap(
        supabase.from('cellphone_assignments').select('*').order('employee_name')
    ).then(res => ({ data: res.data || [] })),

    getLaptopReport: () => wrap(
        supabase.from('laptop_assignments').select('*').order('employee_name')
    ).then(res => ({ data: res.data || [] })),

    getCalibrationDueReport: () => wrap(
        supabase.from('calibration_records')
            .select(`id, serial_number, expiry_date, calibration_status, certificate_number, calibration_provider, calibration_date,
                equipment(equipment_id, equipment_name, manufacturer, categories(name))`)
            .in('calibration_status', ['Expired', 'Due Soon'])
            .order('expiry_date', { ascending: true })
    ).then(res => ({
        data: (res.data || []).map(r => ({ ...r,
            equipment_code: r.equipment?.equipment_id, equipment_name: r.equipment?.equipment_name,
            manufacturer: r.equipment?.manufacturer, category: r.equipment?.categories?.name,
            equipment: undefined,
        }))
    })),
};

// Customers
export const customersApi = {
    getAll: async (params = {}) => {
        const { country, search, active_only, has_equipment } = params;
        let query = supabase.from('customers')
            .select('id, customer_number, display_name, currency_code, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, tax_registration_number, vat_treatment, email, is_active, created_at')
            .order('display_name');
        if (active_only !== 'false') query = query.eq('is_active', true);
        if (country) query = query.eq('billing_country', country);
        if (search) query = query.or(`display_name.ilike.%${escapeSearch(search)}%,customer_number.ilike.%${escapeSearch(search)}%`);
        const result = await wrap(query);
        if (has_equipment) {
            const { data: movements } = await supabase.from('equipment_movements')
                .select('customer_id, equipment!inner(status)')
                .eq('action', 'OUT')
                .eq('equipment.status', 'Checked Out');
            const idsWithEquipment = new Set((movements || []).map(m => m.customer_id));
            return { data: (result.data || []).filter(c => idsWithEquipment.has(c.id)) };
        }
        return result;
    },
    getById: (id) => wrap(supabase.from('customers').select('*').eq('id', id).single()),
    create: (data) => wrap(supabase.from('customers').insert({ ...data, currency_code: data.currency_code || 'ZAR' }).select().single()),
    update: (id, data) => wrap(supabase.from('customers').update(data).eq('id', id).select().single()),
    getStats: () => wrapRpc(supabase.rpc('get_customer_stats')),
    getEquipment: (customerId) => wrap(
        supabase.from('equipment_movements')
            .select(`id, action, created_at, notes,
                equipment!inner(id, equipment_id, equipment_name, serial_number, status, categories(name)),
                personnel(full_name)`)
            .eq('customer_id', customerId)
            .eq('action', 'OUT')
            .eq('equipment.status', 'Checked Out')
            .order('created_at', { ascending: false })
    ).then(res => ({
        data: (res.data || []).map(m => ({
            id: m.equipment?.id,
            equipment_id: m.equipment?.equipment_id,
            equipment_name: m.equipment?.equipment_name,
            serial_number: m.equipment?.serial_number,
            category: m.equipment?.categories?.name,
            checked_out_to: m.personnel?.full_name,
            checked_out_at: m.created_at,
        }))
    })),
};

// Calibration
export const calibrationApi = {
    getStatus: (params = {}) => {
        const { status, category, search } = params;
        return wrapRpc(
            supabase.rpc('get_calibration_management', {
                p_status: status || null,
                p_category: category || null,
                p_search: search || null,
            })
        ).then(res => ({ data: res.data || [] }));
    },

    getDue: () => wrap(
        supabase.from('calibration_records')
            .select(`id, serial_number, expiry_date, calibration_status, certificate_number,
                equipment(equipment_id, equipment_name, manufacturer, categories(name))`)
            .in('calibration_status', ['Expired', 'Due Soon'])
            .order('expiry_date', { ascending: true })
    ).then(res => ({
        data: (res.data || []).map(r => ({ ...r,
            equipment_code: r.equipment?.equipment_id, equipment_name: r.equipment?.equipment_name,
            manufacturer: r.equipment?.manufacturer, category: r.equipment?.categories?.name,
            equipment: undefined,
        }))
    })),

    getSummary: () => wrapRpc(
        supabase.rpc('get_calibration_summary')
    ),

    getHistory: (equipmentId) => wrap(
        supabase.from('calibration_records')
            .select('id, serial_number, calibration_date, expiry_date, certificate_number, calibration_provider, calibration_status, certificate_file_url, notes, created_at')
            .eq('equipment_id', equipmentId)
            .order('calibration_date', { ascending: false })
    ).then(res => ({
        data: (res.data || []).map(r => ({
            ...r,
            validity_days: r.calibration_date && r.expiry_date
                ? Math.ceil((new Date(r.expiry_date) - new Date(r.calibration_date)) / (1000 * 60 * 60 * 24))
                : null,
        }))
    })),

    create: (data, certificateFile) => {
        let status = data.calibration_status;
        if (!status && data.expiry_date) {
            const days = Math.ceil((new Date(data.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
            if (days < 0) status = 'Expired';
            else if (days <= 30) status = 'Due Soon';
            else status = 'Valid';
        }
        const insertData = {
            equipment_id: data.equipment_id || null, serial_number: data.serial_number,
            calibration_date: data.calibration_date, expiry_date: data.expiry_date,
            certificate_number: data.certificate_number, calibration_provider: data.calibration_provider,
            calibration_status: status || 'Valid', notes: data.notes,
        };
        const promise = wrap(supabase.from('calibration_records').insert(insertData).select().single());
        if (certificateFile) {
            return promise.then(async (result) => {
                const record = result.data;
                const ext = certificateFile.name?.split('.').pop() || 'pdf';
                const fileName = `cert_${record.id}_${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage.from('calibration-certificates').upload(fileName, certificateFile, { contentType: certificateFile.type });
                if (uploadError) throw new Error('Certificate upload failed: ' + uploadError.message);
                const { data: urlData } = supabase.storage.from('calibration-certificates').getPublicUrl(fileName);
                await supabase.from('calibration_records').update({ certificate_file_url: urlData.publicUrl }).eq('id', record.id);
                return { data: { ...record, certificate_file_url: urlData.publicUrl } };
            });
        }
        return promise;
    },

    update: (id, data, certificateFile) => {
        const promise = wrap(supabase.from('calibration_records').update({
            calibration_date: data.calibration_date, expiry_date: data.expiry_date,
            certificate_number: data.certificate_number, calibration_provider: data.calibration_provider,
            calibration_status: data.calibration_status, notes: data.notes,
        }).eq('id', id).select().single());
        if (certificateFile) {
            return promise.then(async (result) => {
                const record = result.data;
                const ext = certificateFile.name?.split('.').pop() || 'pdf';
                const fileName = `cert_${id}_${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage.from('calibration-certificates').upload(fileName, certificateFile, { contentType: certificateFile.type });
                if (uploadError) throw new Error('Certificate upload failed: ' + uploadError.message);
                const { data: urlData } = supabase.storage.from('calibration-certificates').getPublicUrl(fileName);
                await supabase.from('calibration_records').update({ certificate_file_url: urlData.publicUrl }).eq('id', id);
                return { data: { ...record, certificate_file_url: urlData.publicUrl } };
            });
        }
        return promise;
    },

    delete: (id) => wrap(supabase.from('calibration_records').delete().eq('id', id)),
};

// Reservations
export const reservationsApi = {
    getAll: (params = {}) => {
        const { status, equipment_id, personnel_id, customer_id, start_date, end_date } = params;
        let query = supabase.from('reservations')
            .select(`id, equipment_id, personnel_id, customer_id, start_date, end_date,
                purpose, status, notes, created_at, approved_at,
                equipment(equipment_id, equipment_name, serial_number, categories(name)),
                personnel(full_name), customers(display_name)`)
            .order('start_date', { ascending: false });
        if (status) query = query.eq('status', status);
        if (equipment_id) query = query.eq('equipment_id', equipment_id);
        if (personnel_id) query = query.eq('personnel_id', personnel_id);
        if (customer_id) query = query.eq('customer_id', customer_id);
        if (start_date) query = query.gte('end_date', start_date);
        if (end_date) query = query.lte('start_date', end_date);
        return wrap(query).then(res => ({
            data: (res.data || []).map(r => ({ ...r,
                equipment_code: r.equipment?.equipment_id, equipment_name: r.equipment?.equipment_name,
                serial_number: r.equipment?.serial_number, category: r.equipment?.categories?.name,
                personnel_name: r.personnel?.full_name, customer_name: r.customers?.display_name,
                equipment: undefined, personnel: undefined, customers: undefined,
            }))
        }));
    },
    getCalendar: (start, end) => wrap(
        supabase.from('reservations')
            .select(`id, equipment_id, personnel_id, start_date, end_date, status, purpose,
                equipment(equipment_id, equipment_name), personnel(full_name)`)
            .not('status', 'eq', 'cancelled')
            .lte('start_date', end).gte('end_date', start).order('start_date')
    ).then(res => ({
        data: (res.data || []).map(r => ({ ...r,
            equipment_code: r.equipment?.equipment_id, equipment_name: r.equipment?.equipment_name,
            personnel_name: r.personnel?.full_name,
            equipment: undefined, personnel: undefined,
        }))
    })),
    checkAvailability: (equipmentId, startDate, endDate, excludeId) => {
        let query = supabase.from('reservations')
            .select('id, start_date, end_date, status, personnel(full_name)')
            .eq('equipment_id', equipmentId)
            .not('status', 'in', '(cancelled,completed)')
            .lte('start_date', endDate).gte('end_date', startDate);
        if (excludeId) query = query.neq('id', excludeId);
        return wrap(query).then(res => ({
            data: { available: (res.data || []).length === 0,
                conflicts: (res.data || []).map(r => ({ ...r,
                    reserved_by: r.personnel?.full_name, personnel: undefined,
                })),
            }
        }));
    },
    getSummary: () => wrapRpc(supabase.rpc('get_reservation_summary')),
    create: (data) => wrap(supabase.from('reservations').insert({ ...data, status: 'pending', customer_id: data.customer_id || null }).select().single()),
    update: (id, data) => wrap(supabase.from('reservations').update({
        equipment_id: data.equipment_id, personnel_id: data.personnel_id,
        customer_id: data.customer_id || null, start_date: data.start_date,
        end_date: data.end_date, purpose: data.purpose, notes: data.notes,
    }).eq('id', id).select().single()),
    updateStatus: (id, status, approvedBy) => {
        const updateData = { status };
        if (status === 'approved' && approvedBy) {
            updateData.approved_by = approvedBy;
            updateData.approved_at = new Date().toISOString();
        }
        return wrap(supabase.from('reservations').update(updateData).eq('id', id).select().single());
    },
    delete: (id) => wrap(supabase.from('reservations').delete().eq('id', id)),
};

// Maintenance
export const maintenanceApi = {
    getTypes: () => wrap(supabase.from('maintenance_types').select('*').eq('is_active', true).order('name')),
    getAll: (params = {}) => {
        const { equipment_id, status, type_id, from_date, to_date, search } = params;
        let query = supabase.from('maintenance_log')
            .select(`id, equipment_id, maintenance_type_id, maintenance_date, completed_date,
                description, performed_by, external_provider, cost, cost_currency,
                downtime_days, next_maintenance_date, status, work_order_number, notes, created_at,
                equipment(equipment_id, equipment_name, serial_number, categories(name)),
                maintenance_types(name)`)
            .order('maintenance_date', { ascending: false });
        if (equipment_id) query = query.eq('equipment_id', equipment_id);
        if (status) query = query.eq('status', status);
        if (type_id) query = query.eq('maintenance_type_id', type_id);
        if (from_date) query = query.gte('maintenance_date', from_date);
        if (to_date) query = query.lte('maintenance_date', to_date);
        if (search) query = query.or(`description.ilike.%${escapeSearch(search)}%,work_order_number.ilike.%${escapeSearch(search)}%`);
        return wrap(query).then(res => ({
            data: (res.data || []).map(m => ({ ...m,
                equipment_code: m.equipment?.equipment_id, equipment_name: m.equipment?.equipment_name,
                serial_number: m.equipment?.serial_number, category: m.equipment?.categories?.name,
                maintenance_type: m.maintenance_types?.name,
                equipment: undefined, maintenance_types: undefined,
            }))
        }));
    },
    getForEquipment: (equipmentId) => wrap(
        supabase.from('maintenance_log').select('*, maintenance_types(name)')
            .eq('equipment_id', equipmentId).order('maintenance_date', { ascending: false })
    ).then(res => ({
        data: (res.data || []).map(m => ({ ...m, maintenance_type: m.maintenance_types?.name, maintenance_types: undefined }))
    })),
    getDue: (days = 30) => wrap(
        supabase.from('equipment')
            .select('id, equipment_id, equipment_name, serial_number, next_maintenance_date, categories(name)')
            .not('next_maintenance_date', 'is', null)
            .lte('next_maintenance_date', new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('next_maintenance_date')
    ).then(res => ({
        data: (res.data || []).map(e => ({ ...e,
            category: e.categories?.name,
            maintenance_status: new Date(e.next_maintenance_date) < new Date() ? 'overdue' : 'due_soon',
            days_until_due: Math.ceil((new Date(e.next_maintenance_date) - new Date()) / (1000 * 60 * 60 * 24)),
            categories: undefined,
        }))
    })),
    getOverdue: () => wrap(
        supabase.from('equipment')
            .select('id, equipment_id, equipment_name, serial_number, next_maintenance_date, categories(name)')
            .not('next_maintenance_date', 'is', null)
            .lt('next_maintenance_date', new Date().toISOString().split('T')[0])
            .order('next_maintenance_date')
    ).then(res => ({
        data: (res.data || []).map(e => ({ ...e,
            category: e.categories?.name,
            days_overdue: Math.ceil((new Date() - new Date(e.next_maintenance_date)) / (1000 * 60 * 60 * 24)),
            categories: undefined,
        }))
    })),
    getSummary: () => wrapRpc(supabase.rpc('get_maintenance_summary')),
    create: (data) => wrap(
        supabase.from('maintenance_log').insert({
            equipment_id: data.equipment_id, maintenance_type_id: data.maintenance_type_id,
            maintenance_date: data.maintenance_date, completed_date: data.completed_date || null,
            description: data.description, performed_by: data.performed_by || null,
            external_provider: data.external_provider || null, cost: data.cost || null,
            cost_currency: data.cost_currency || 'ZAR', downtime_days: data.downtime_days || 0,
            next_maintenance_date: data.next_maintenance_date || null,
            status: data.status || 'scheduled', work_order_number: data.work_order_number || null,
            notes: data.notes || null,
        }).select().single()
    ).then(async (result) => {
        if (data.next_maintenance_date) {
            await supabase.from('equipment')
                .update({ next_maintenance_date: data.next_maintenance_date })
                .eq('id', data.equipment_id);
        }
        return result;
    }),
    update: (id, data) => wrap(supabase.from('maintenance_log').update(data).eq('id', id).select().single()),
    complete: (id, data) => wrap(supabase.from('maintenance_log').update({
        status: 'completed', completed_date: data.completed_date || new Date().toISOString().split('T')[0], ...data,
    }).eq('id', id).select().single()),
    delete: (id) => wrap(supabase.from('maintenance_log').delete().eq('id', id)),
};

// Audit Log
export const auditApi = {
    getAll: (params = {}) => {
        const { table_name, record_id, action, user_id, from_date, to_date, limit = 100, offset = 0 } = params;
        let query = supabase.from('audit_log')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (table_name) query = query.eq('table_name', table_name);
        if (record_id) query = query.eq('record_id', record_id);
        if (action) query = query.eq('action', action);
        if (user_id) query = query.eq('changed_by', user_id);
        if (from_date) query = query.gte('created_at', from_date);
        if (to_date) query = query.lte('created_at', to_date);
        return query.then(({ data, error, count }) => {
            if (error) throw new Error(error.message);
            return { data: {
                items: (data || []).map(a => {
                    const changed = [];
                    if (a.action === 'UPDATE' && a.old_values && a.new_values) {
                        for (const key of Object.keys(a.new_values)) {
                            if (JSON.stringify(a.old_values[key]) !== JSON.stringify(a.new_values[key])) {
                                changed.push(key);
                            }
                        }
                    }
                    return { ...a, user_full_name: a.changed_by_name || a.changed_by || 'System', changed_fields: changed };
                }),
                total: count || 0, limit: parseInt(limit), offset: parseInt(offset),
            }};
        });
    },
    getForRecord: (tableName, recordId) => wrap(
        supabase.from('audit_log').select('*').eq('table_name', tableName).eq('record_id', recordId)
            .order('created_at', { ascending: false })
    ).then(res => ({
        data: (res.data || []).map(a => ({ ...a, user_full_name: a.changed_by_name || 'System' }))
    })),
    getSummary: (days = 30) => wrapRpc(supabase.rpc('get_audit_summary', { p_days: days })),
};

// Notifications
export const notificationsApi = {
    getAll: (params = {}) => {
        const { user_id, is_read, type, limit = 50 } = params;
        let query = supabase.from('notifications').select('*')
            .order('created_at', { ascending: false }).limit(limit);
        if (user_id) query = query.or(`user_id.eq.${user_id},user_id.is.null`);
        if (is_read !== undefined) query = query.eq('is_read', is_read === 'true');
        if (type) query = query.eq('type', type);
        return wrap(query);
    },
    getAlerts: () => wrap(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(10)),
    getUnreadCount: (userId) => supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
        .or(`user_id.eq.${userId},user_id.is.null`)
        .then(({ count, error }) => {
            if (error) return { data: { count: 0 } };
            return { data: { count: count || 0 } };
        }),
    markAsRead: (id) => wrap(supabase.from('notifications').update({ is_read: true }).eq('id', id).select().single()),
    markAllAsRead: (userId) => wrap(
        supabase.from('notifications').update({ is_read: true })
            .eq('is_read', false).or(`user_id.eq.${userId},user_id.is.null`).select()
    ).then(() => ({ data: { message: 'All notifications marked as read' } })),
    delete: (id) => wrap(supabase.from('notifications').delete().eq('id', id)),
    generate: () => wrapRpc(supabase.rpc('generate_notifications')),
    getSettings: (userId) => Promise.resolve({ data: {} }),
    updateSettings: (userId, data) => Promise.resolve({ data: {} }),
};


// Users & Roles
export const usersApi = {
    getRoles: () => wrap(supabase.from('roles').select('*').order('id')),
    getAll: (params = {}) => {
        const { role_id, is_active, search } = params;
        let query = supabase.from('users')
            .select(`id, username, email, full_name, role_id, personnel_id,
                is_active, last_login, phone, department, created_at,
                roles(name, permissions), personnel(employee_id)`)
            .order('full_name');
        if (role_id) query = query.eq('role_id', role_id);
        if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');
        if (search) query = query.or(`username.ilike.%${escapeSearch(search)}%,full_name.ilike.%${escapeSearch(search)}%,email.ilike.%${escapeSearch(search)}%`);
        return wrap(query).then(res => ({
            data: (res.data || []).map(u => ({ ...u,
                role_name: u.roles?.name, permissions: u.roles?.permissions,
                employee_id: u.personnel?.employee_id,
                roles: undefined, personnel: undefined,
            }))
        }));
    },
    getById: (id) => wrap(
        supabase.from('users').select('*, roles(name, permissions), personnel(employee_id, full_name)').eq('id', id).single()
    ).then(res => {
        const u = res.data;
        const result = { ...u, role_name: u.roles?.name, permissions: u.roles?.permissions,
            employee_id: u.personnel?.employee_id, personnel_name: u.personnel?.full_name,
            roles: undefined, personnel: undefined,
        };
        delete result.password_hash;
        return { data: result };
    }),
    create: (data) => wrap(supabase.from('users').insert({
        username: data.username, email: data.email, full_name: data.full_name,
        role_id: data.role_id || 3, personnel_id: data.personnel_id || null,
        is_active: data.is_active !== false, phone: data.phone || null, department: data.department || null,
    }).select().single()),
    update: (id, data) => wrap(supabase.from('users').update({
        username: data.username, email: data.email, full_name: data.full_name,
        role_id: data.role_id, personnel_id: data.personnel_id || null,
        is_active: data.is_active, phone: data.phone || null, department: data.department || null,
    }).eq('id', id).select().single()),
    updateRole: (id, roleId) => wrap(supabase.from('users').update({ role_id: roleId }).eq('id', id).select().single()),
    updateStatus: (id, isActive) => wrap(supabase.from('users').update({ is_active: isActive }).eq('id', id).select().single()),
    recordLogin: (personnelId) => wrap(
        supabase.from('users').update({ last_login: new Date().toISOString() }).eq('personnel_id', personnelId).select().single()
    ),
    delete: (id) => wrap(supabase.from('users').delete().eq('id', id)),
    getByPersonnelId: (personnelId) => wrap(
        supabase.from('users').select('*, roles(name, permissions)').eq('personnel_id', personnelId).limit(1).maybeSingle()
    ).then(res => {
        if (!res.data) return { data: null };
        const u = res.data;
        return { data: { ...u, role_name: u.roles?.name, permissions: u.roles?.permissions, roles: undefined } };
    }),
    getPermissions: (id) => wrap(
        supabase.from('users').select('roles(permissions)').eq('id', id).single()
    ).then(res => ({ data: res.data?.roles?.permissions || {} })),
    bulkImport: async (personnelIds, roleId) => {
        const { data: people } = await supabase.from('personnel')
            .select('id, full_name, email, employee_id').in('id', personnelIds);
        const { data: existing } = await supabase.from('users')
            .select('personnel_id').in('personnel_id', personnelIds);
        const existingSet = new Set((existing || []).map(r => r.personnel_id));
        const created = [], skipped = [];
        for (const person of (people || [])) {
            if (existingSet.has(person.id)) { skipped.push({ id: person.id, name: person.full_name, reason: 'Already linked' }); continue; }
            const username = person.employee_id || person.full_name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
            const { data: check } = await supabase.from('users').select('id').eq('username', username).limit(1);
            if (check?.length > 0) { skipped.push({ id: person.id, name: person.full_name, reason: 'Username exists' }); continue; }
            const { data: newUser } = await supabase.from('users').insert({
                username, email: person.email, full_name: person.full_name,
                role_id: roleId || 3, personnel_id: person.id, is_active: true,
            }).select().single();
            if (newUser) created.push(newUser);
        }
        return { data: { message: `Created ${created.length} users, skipped ${skipped.length}`, created, skipped } };
    },
    createRole: (data) => wrap(supabase.from('roles').insert(data).select().single()),
    deleteRole: (id) => wrap(supabase.from('roles').delete().eq('id', id)),
};

// Equipment Images
export const equipmentImagesApi = {
    getAll: (equipmentId) => wrap(
        supabase.from('equipment_images').select('*')
            .eq('equipment_id', equipmentId)
            .order('is_primary', { ascending: false })
            .order('sort_order').order('created_at')
    ),
    getImageUrl: (imageId) => {
        return supabase.storage.from('equipment-images').getPublicUrl(`image_${imageId}`).data?.publicUrl || '';
    },
    getPrimary: (equipmentId) => wrap(
        supabase.from('equipment_images').select('*')
            .eq('equipment_id', equipmentId).eq('is_primary', true).limit(1).single()
    ),
    upload: async (equipmentId, file, caption, isPrimary, uploadedBy) => {
        if (isPrimary === 'true' || isPrimary === true) {
            await supabase.from('equipment_images').update({ is_primary: false }).eq('equipment_id', equipmentId);
        }
        const fileName = `eq-${equipmentId}-${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('equipment-images')
            .upload(fileName, file, { contentType: file.type });
        if (uploadError) throw new Error(uploadError.message);
        const { data: urlData } = supabase.storage.from('equipment-images').getPublicUrl(fileName);
        const { data: maxOrder } = await supabase.from('equipment_images')
            .select('sort_order').eq('equipment_id', equipmentId)
            .order('sort_order', { ascending: false }).limit(1);
        const nextOrder = (maxOrder?.[0]?.sort_order || 0) + 1;
        return wrap(supabase.from('equipment_images').insert({
            equipment_id: equipmentId, filename: fileName, original_filename: file.name,
            file_path: urlData.publicUrl, file_size: file.size, mime_type: file.type,
            caption: caption || null, is_primary: isPrimary === 'true' || isPrimary === true,
            sort_order: nextOrder, uploaded_by: uploadedBy || null,
        }).select().single());
    },
    uploadMultiple: async (equipmentId, files, uploadedBy) => {
        const { data: maxOrder } = await supabase.from('equipment_images')
            .select('sort_order').eq('equipment_id', equipmentId)
            .order('sort_order', { ascending: false }).limit(1);
        let currentOrder = maxOrder?.[0]?.sort_order || 0;
        const uploaded = [];
        for (const file of files) {
            currentOrder++;
            const fileName = `eq-${equipmentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${file.name.substring(file.name.lastIndexOf('.'))}`;
            await supabase.storage.from('equipment-images').upload(fileName, file, { contentType: file.type });
            const { data: urlData } = supabase.storage.from('equipment-images').getPublicUrl(fileName);
            const { data: img } = await supabase.from('equipment_images').insert({
                equipment_id: equipmentId, filename: fileName, original_filename: file.name,
                file_path: urlData.publicUrl, file_size: file.size, mime_type: file.type,
                sort_order: currentOrder, uploaded_by: uploadedBy || null,
            }).select().single();
            if (img) uploaded.push(img);
        }
        return { data: uploaded };
    },
    update: (imageId, data) => wrap(supabase.from('equipment_images').update(data).eq('id', imageId).select().single()),
    setPrimary: async (imageId) => {
        const { data: img } = await supabase.from('equipment_images').select('equipment_id').eq('id', imageId).single();
        if (img) await supabase.from('equipment_images').update({ is_primary: false }).eq('equipment_id', img.equipment_id);
        return wrap(supabase.from('equipment_images').update({ is_primary: true }).eq('id', imageId).select().single());
    },
    reorder: async (equipmentId, imageIds) => {
        for (let i = 0; i < imageIds.length; i++) {
            await supabase.from('equipment_images').update({ sort_order: i + 1 }).eq('id', imageIds[i]).eq('equipment_id', equipmentId);
        }
        return wrap(supabase.from('equipment_images').select('*').eq('equipment_id', equipmentId).order('sort_order'));
    },
    delete: async (imageId) => {
        const { data: img } = await supabase.from('equipment_images').select('filename').eq('id', imageId).single();
        if (img?.filename) await supabase.storage.from('equipment-images').remove([img.filename]);
        return wrap(supabase.from('equipment_images').delete().eq('id', imageId));
    },
};

// Laptop Assignments
export const laptopAssignmentsApi = {
    getAll: (activeOnly = true) => {
        let query = supabase.from('laptop_assignments').select('*').order('employee_name');
        if (activeOnly) query = query.eq('is_active', true);
        return wrap(query);
    },
    getById: (id) => wrap(
        supabase.from('laptop_assignments').select('*').eq('id', id).single()
    ),
    searchBySerial: (serial) => wrap(
        supabase.from('laptop_assignments')
            .select('*')
            .ilike('serial_number', `%${serial}%`)
            .order('created_at', { ascending: false })
    ),
    create: (data) => wrap(
        supabase.from('laptop_assignments').insert(data).select().single()
    ),
    update: (id, data) => wrap(
        supabase.from('laptop_assignments').update(data).eq('id', id).select().single()
    ),
    reassign: async (id, newAssignment) => {
        // 1. Get current assignment
        const { data: current } = await supabase.from('laptop_assignments').select('*').eq('id', id).single();
        if (!current) throw new Error('Laptop assignment not found');

        // 2. Log the old assignment to history
        await supabase.from('laptop_history').insert({
            laptop_assignment_id: id,
            action: 'Reassigned',
            employee_name: current.employee_name,
            employee_id: current.employee_id,
            employee_email: current.employee_email,
            laptop_status: current.laptop_status,
            notes: `Reassigned from ${current.employee_name} to ${newAssignment.employee_name}`,
        }).then(({ error }) => { if (error) console.error('History insert failed:', error.message); });

        // 3. Update the assignment with new employee info
        return wrap(
            supabase.from('laptop_assignments').update({
                employee_name: newAssignment.employee_name,
                employee_id: newAssignment.employee_id,
                employee_email: newAssignment.employee_email,
                date_assigned: newAssignment.date_assigned || new Date().toISOString().split('T')[0],
                date_returned: null,
                laptop_status: 'Active',
                is_active: true,
                setup_laptop: newAssignment.setup_laptop ?? false,
                setup_m365: newAssignment.setup_m365 ?? false,
                setup_adobe: newAssignment.setup_adobe ?? false,
                setup_zoho: newAssignment.setup_zoho ?? false,
                setup_smartsheet: newAssignment.setup_smartsheet ?? false,
                setup_distribution_lists: newAssignment.setup_distribution_lists ?? false,
                notes: newAssignment.notes || null,
            }).eq('id', id).select().single()
        );
    },
    updateStatus: async (id, status) => {
        // Log status change to history
        const { data: current } = await supabase.from('laptop_assignments').select('*').eq('id', id).single();
        if (current) {
            await supabase.from('laptop_history').insert({
                laptop_assignment_id: id,
                action: `Status: ${current.laptop_status} → ${status}`,
                employee_name: current.employee_name,
                employee_id: current.employee_id,
                employee_email: current.employee_email,
                laptop_status: status,
                notes: null,
            }).then(({ error }) => { if (error) console.error('History insert failed:', error.message); });
        }

        const updates = { laptop_status: status };
        const inactiveStatuses = ['Returned', 'Stolen', 'Lost', 'Decommissioned'];
        updates.is_active = !inactiveStatuses.includes(status);
        if (status === 'Returned') {
            updates.date_returned = new Date().toISOString().split('T')[0];
        }
        return wrap(
            supabase.from('laptop_assignments').update(updates).eq('id', id).select().single()
        );
    },
    getHistory: (assignmentId) => wrap(
        supabase.from('laptop_history')
            .select('*')
            .eq('laptop_assignment_id', assignmentId)
            .order('performed_at', { ascending: false })
    ),
    delete: (id) => wrap(
        supabase.from('laptop_assignments').delete().eq('id', id)
    ),
};

// Cellphone Assignments
export const cellphoneAssignmentsApi = {
    getAll: (activeOnly = true) => {
        let query = supabase.from('cellphone_assignments').select('*').order('employee_name');
        if (activeOnly) query = query.eq('is_active', true);
        return wrap(query);
    },
    getById: (id) => wrap(
        supabase.from('cellphone_assignments').select('*').eq('id', id).single()
    ),
    searchBySerial: (serial) => wrap(
        supabase.from('cellphone_assignments')
            .select('*')
            .ilike('serial_number', `%${serial}%`)
            .order('created_at', { ascending: false })
    ),
    create: (data) => wrap(
        supabase.from('cellphone_assignments').insert(data).select().single()
    ),
    update: (id, data) => wrap(
        supabase.from('cellphone_assignments').update(data).eq('id', id).select().single()
    ),
    reassign: async (id, newAssignment) => {
        const { data: current } = await supabase.from('cellphone_assignments').select('*').eq('id', id).single();
        if (!current) throw new Error('Cellphone assignment not found');

        await supabase.from('cellphone_history').insert({
            cellphone_assignment_id: id,
            action: 'Reassigned',
            employee_name: current.employee_name,
            employee_id: current.employee_id,
            employee_email: current.employee_email,
            phone_status: current.phone_status,
            notes: `Reassigned from ${current.employee_name} to ${newAssignment.employee_name}`,
        }).then(({ error }) => { if (error) console.error('History insert failed:', error.message); });

        return wrap(
            supabase.from('cellphone_assignments').update({
                employee_name: newAssignment.employee_name,
                employee_id: newAssignment.employee_id,
                employee_email: newAssignment.employee_email,
                date_assigned: newAssignment.date_assigned || new Date().toISOString().split('T')[0],
                date_returned: null,
                phone_status: 'Active',
                is_active: true,
                notes: newAssignment.notes || null,
            }).eq('id', id).select().single()
        );
    },
    updateStatus: async (id, status) => {
        const { data: current } = await supabase.from('cellphone_assignments').select('*').eq('id', id).single();
        if (current) {
            await supabase.from('cellphone_history').insert({
                cellphone_assignment_id: id,
                action: `Status: ${current.phone_status} → ${status}`,
                employee_name: current.employee_name,
                employee_id: current.employee_id,
                employee_email: current.employee_email,
                phone_status: status,
                notes: null,
            }).then(({ error }) => { if (error) console.error('History insert failed:', error.message); });
        }

        const updates = { phone_status: status };
        const inactiveStatuses = ['Returned', 'Stolen', 'Lost', 'Decommissioned'];
        updates.is_active = !inactiveStatuses.includes(status);
        if (status === 'Returned') {
            updates.date_returned = new Date().toISOString().split('T')[0];
        }
        return wrap(
            supabase.from('cellphone_assignments').update(updates).eq('id', id).select().single()
        );
    },
    getHistory: (assignmentId) => wrap(
        supabase.from('cellphone_history')
            .select('*')
            .eq('cellphone_assignment_id', assignmentId)
            .order('performed_at', { ascending: false })
    ),
    delete: (id) => wrap(
        supabase.from('cellphone_assignments').delete().eq('id', id)
    ),
};

// ============================================
// Vehicles
// ============================================
export const vehiclesApi = {
    getAll: (activeOnly = true) => {
        let query = supabase.from('vehicles').select('*').order('make');
        if (activeOnly) query = query.eq('is_active', true);
        return wrap(query);
    },
    getById: (id) => wrap(
        supabase.from('vehicles').select('*').eq('id', id).single()
    ),
    create: (data) => wrap(
        supabase.from('vehicles').insert(data).select().single()
    ),
    update: (id, data) => wrap(
        supabase.from('vehicles').update(data).eq('id', id).select().single()
    ),
    updateStatus: async (id, status) => {
        const updates = { vehicle_status: status };
        const inactiveStatuses = ['Decommissioned', 'Sold', 'Written Off'];
        updates.is_active = !inactiveStatuses.includes(status);
        return wrap(
            supabase.from('vehicles').update(updates).eq('id', id).select().single()
        );
    },
    delete: (id) => wrap(
        supabase.from('vehicles').delete().eq('id', id)
    ),
};

// Vehicle Checkouts (pre-trip inspections)
export const vehicleCheckoutsApi = {
    getAll: (vehicleId = null, returnedOnly = false) => {
        let query = supabase.from('vehicle_checkouts').select('*, vehicles(make, model, registration_number)').order('checkout_date', { ascending: false });
        if (vehicleId) query = query.eq('vehicle_id', vehicleId);
        if (!returnedOnly) query = query.eq('is_returned', false);
        return wrap(query);
    },
    getAllIncludingReturned: (vehicleId = null) => {
        let query = supabase.from('vehicle_checkouts').select('*, vehicles(make, model, registration_number)').order('checkout_date', { ascending: false });
        if (vehicleId) query = query.eq('vehicle_id', vehicleId);
        return wrap(query);
    },
    getById: (id) => wrap(
        supabase.from('vehicle_checkouts').select('*, vehicles(make, model, registration_number)').eq('id', id).single()
    ),
    create: async (data) => {
        const result = await wrap(
            supabase.from('vehicle_checkouts').insert(data).select().single()
        );
        // Update vehicle's current odometer
        if (data.start_odometer) {
            await supabase.from('vehicles').update({ current_odometer: data.start_odometer }).eq('id', data.vehicle_id);
        }
        return result;
    },
    update: (id, data) => wrap(
        supabase.from('vehicle_checkouts').update(data).eq('id', id).select().single()
    ),
    returnVehicle: async (id, { endOdometer, returnLocation, handedOverTo, returnNotes }) => {
        const { data: checkout } = await supabase.from('vehicle_checkouts').select('*').eq('id', id).single();
        if (!checkout) throw new Error('Checkout record not found');
        const updateData = {
            is_returned: true,
            return_date: new Date().toISOString(),
            end_odometer: endOdometer,
        };
        if (returnLocation) updateData.return_location = returnLocation;
        if (handedOverTo) updateData.handed_over_to = handedOverTo;
        if (returnNotes) updateData.return_notes = returnNotes;
        const result = await wrap(
            supabase.from('vehicle_checkouts').update(updateData).eq('id', id).select().single()
        );
        if (endOdometer) {
            await supabase.from('vehicles').update({ current_odometer: endOdometer }).eq('id', checkout.vehicle_id);
        }
        return result;
    },
    delete: (id) => wrap(
        supabase.from('vehicle_checkouts').delete().eq('id', id)
    ),
};

// Vehicle Fines
export const vehicleFinesApi = {
    getAll: (vehicleId = null) => {
        let query = supabase.from('vehicle_fines').select('*, vehicles(make, model, registration_number)').order('fine_date', { ascending: false });
        if (vehicleId) query = query.eq('vehicle_id', vehicleId);
        return wrap(query);
    },
    create: (data) => wrap(
        supabase.from('vehicle_fines').insert(data).select().single()
    ),
    update: (id, data) => wrap(
        supabase.from('vehicle_fines').update(data).eq('id', id).select().single()
    ),
    delete: (id) => wrap(
        supabase.from('vehicle_fines').delete().eq('id', id)
    ),
};

// Vehicle Services / Repairs
export const vehicleServicesApi = {
    getAll: (vehicleId = null) => {
        let query = supabase.from('vehicle_services').select('*, vehicles(make, model, registration_number)').order('service_date', { ascending: false });
        if (vehicleId) query = query.eq('vehicle_id', vehicleId);
        return wrap(query);
    },
    create: (data) => wrap(
        supabase.from('vehicle_services').insert(data).select().single()
    ),
    update: (id, data) => wrap(
        supabase.from('vehicle_services').update(data).eq('id', id).select().single()
    ),
    delete: (id) => wrap(
        supabase.from('vehicle_services').delete().eq('id', id)
    ),
};

export default supabase;

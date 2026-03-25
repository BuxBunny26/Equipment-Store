import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  laptopAssignmentsApi, cellphoneAssignmentsApi,
  vehiclesApi, vehicleCheckoutsApi, vehicleFinesApi, vehicleServicesApi,
} from '../services/api';
import { Icons } from '../components/Icons';

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#9c27b0', '#00796b', '#5d4037', '#455a64', '#c2185b', '#0288d1'];

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    let timeout;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setWidth(window.innerWidth), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(timeout); };
  }, []);
  return width;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      {label && <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.fill, fontSize: '0.82rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, display: 'inline-block' }} />
          {p.name}: <strong>{typeof p.value === 'number' && p.name?.toLowerCase().includes('cost') ? `R${p.value.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

function AssetAnalytics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const isSmall = windowWidth <= 480;

  const [laptops, setLaptops] = useState([]);
  const [cellphones, setCellphones] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [fines, setFines] = useState([]);
  const [services, setServices] = useState([]);

  const yAxisWidth = isMobile ? 80 : 120;
  const truncLabel = (label) => label && label.length > (isMobile ? 12 : 18) ? label.slice(0, isMobile ? 11 : 17) + '...' : label;

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [lapRes, phoneRes, vehRes, coRes, fineRes, svcRes] = await Promise.all([
        laptopAssignmentsApi.getAll(false),
        cellphoneAssignmentsApi.getAll(false),
        vehiclesApi.getAll(false),
        vehicleCheckoutsApi.getAllIncludingReturned(),
        vehicleFinesApi.getAll(),
        vehicleServicesApi.getAll(),
      ]);
      setLaptops(lapRes.data || []);
      setCellphones(phoneRes.data || []);
      setVehicles(vehRes.data || []);
      setCheckouts(coRes.data || []);
      setFines(fineRes.data || []);
      setServices(svcRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Computed data ----

  const ageMonths = (dateStr) => {
    if (!dateStr) return 0;
    return Math.max(0, (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24 * 30.44));
  };

  const formatAge = (months) => {
    if (months < 1) return '< 1 mo';
    if (months < 12) return `${Math.round(months)} mo`;
    const y = Math.floor(months / 12);
    const m = Math.round(months % 12);
    return m > 0 ? `${y}y ${m}m` : `${y}y`;
  };

  // Overview stats
  const overviewStats = useMemo(() => {
    const laptopActive = laptops.filter(l => l.laptop_status === 'Active').length;
    const phoneActive = cellphones.filter(c => c.phone_status === 'Active').length;
    const vehicleActive = vehicles.filter(v => v.is_active).length;
    const totalActive = laptopActive + phoneActive + vehicleActive;
    const totalAssets = laptops.length + cellphones.length + vehicles.length;

    const laptopDeviceCost = laptops.reduce((s, l) => s + (parseFloat(l.device_cost) || 0), 0);
    const phoneDeviceCost = cellphones.reduce((s, c) => s + (parseFloat(c.device_cost) || 0), 0);
    const laptopYearlyCost = laptops.filter(l => l.laptop_status === 'Active').reduce((s, l) => s + (parseFloat(l.monthly_cost) || 0), 0);
    const phoneMonthlyCost = cellphones.filter(c => c.phone_status === 'Active').reduce((s, c) => s + (parseFloat(c.monthly_cost) || 0), 0);
    const totalDeviceCost = laptopDeviceCost + phoneDeviceCost;
    const totalMonthlyCost = phoneMonthlyCost;
    const totalAnnualRecurring = laptopYearlyCost + (phoneMonthlyCost * 12);

    const unpaidFines = fines.filter(f => f.status === 'Unpaid');
    const totalFines = unpaidFines.reduce((s, f) => s + (parseFloat(f.fine_amount) || 0), 0);

    return { totalAssets, totalActive, laptopActive, phoneActive, vehicleActive, totalDeviceCost, totalMonthlyCost, totalAnnualRecurring, unpaidFineCount: unpaidFines.length, totalFines, laptopDeviceCost, phoneDeviceCost, laptopYearlyCost, phoneMonthlyCost };
  }, [laptops, cellphones, vehicles, fines]);

  // Asset type distribution for pie chart
  const assetDistribution = useMemo(() => [
    { name: 'Laptops', value: laptops.length },
    { name: 'Cellphones', value: cellphones.length },
    { name: 'Vehicles', value: vehicles.length },
  ].filter(d => d.value > 0), [laptops, cellphones, vehicles]);

  // Laptop analytics
  const laptopStats = useMemo(() => {
    const statusCounts = {};
    const brandCounts = {};
    const upgradeStatus = { Due: 0, Approaching: 0, OK: 0 };
    laptops.forEach(l => {
      statusCounts[l.laptop_status] = (statusCounts[l.laptop_status] || 0) + 1;
      const brand = l.laptop_brand || 'Unknown';
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
      if (l.laptop_status === 'Active' && l.date_assigned) {
        const months = ageMonths(l.date_assigned);
        if (months >= 48) upgradeStatus.Due++;
        else if (months >= 36) upgradeStatus.Approaching++;
        else upgradeStatus.OK++;
      }
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const brandData = Object.entries(brandCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const upgradeData = Object.entries(upgradeStatus).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
    return { statusData, brandData, upgradeData, upgradeStatus };
  }, [laptops]);

  // Cellphone analytics
  const cellphoneStats = useMemo(() => {
    const statusCounts = {};
    const brandCounts = {};
    const networkCounts = {};
    const upgradeStatus = { Due: 0, Approaching: 0, OK: 0 };
    cellphones.forEach(c => {
      statusCounts[c.phone_status] = (statusCounts[c.phone_status] || 0) + 1;
      const brand = c.phone_brand || 'Unknown';
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
      const network = c.network_provider || 'Unknown';
      networkCounts[network] = (networkCounts[network] || 0) + 1;
      if (c.phone_status === 'Active' && c.date_assigned) {
        const months = ageMonths(c.date_assigned);
        if (months >= 24) upgradeStatus.Due++;
        else if (months >= 18) upgradeStatus.Approaching++;
        else upgradeStatus.OK++;
      }
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const brandData = Object.entries(brandCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const networkData = Object.entries(networkCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const upgradeData = Object.entries(upgradeStatus).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
    return { statusData, brandData, networkData, upgradeData, upgradeStatus };
  }, [cellphones]);

  // Vehicle analytics
  const vehicleStats = useMemo(() => {
    const statusCounts = {};
    const makeCounts = {};
    const fuelCounts = {};
    vehicles.forEach(v => {
      statusCounts[v.vehicle_status || 'Unknown'] = (statusCounts[v.vehicle_status || 'Unknown'] || 0) + 1;
      const make = v.make || 'Unknown';
      makeCounts[make] = (makeCounts[make] || 0) + 1;
      const fuel = v.fuel_type || 'Unknown';
      fuelCounts[fuel] = (fuelCounts[fuel] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const makeData = Object.entries(makeCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const fuelData = Object.entries(fuelCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Checkout frequency per month (last 12 months)
    const now = new Date();
    const monthlyCheckouts = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
      const month = d.getMonth();
      const year = d.getFullYear();
      const count = checkouts.filter(co => {
        const cd = new Date(co.checkout_date || co.created_at);
        return cd.getMonth() === month && cd.getFullYear() === year;
      }).length;
      monthlyCheckouts.push({ label, checkouts: count });
    }

    // Fine breakdown
    const fineByType = {};
    fines.forEach(f => {
      const type = f.fine_type || 'Other';
      fineByType[type] = (fineByType[type] || 0) + (parseFloat(f.fine_amount) || 0);
    });
    const fineTypeData = Object.entries(fineByType).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);

    // Top fined drivers
    const driverFines = {};
    fines.forEach(f => {
      const driver = f.driver_name || 'Unknown';
      if (!driverFines[driver]) driverFines[driver] = { count: 0, total: 0 };
      driverFines[driver].count++;
      driverFines[driver].total += parseFloat(f.fine_amount) || 0;
    });
    const topDriverFines = Object.entries(driverFines).map(([name, d]) => ({ name, count: d.count, total: Math.round(d.total * 100) / 100 })).sort((a, b) => b.total - a.total).slice(0, 10);

    // Service frequency
    const svcByType = {};
    services.forEach(s => {
      const type = s.service_type || 'General';
      svcByType[type] = (svcByType[type] || 0) + 1;
    });
    const serviceTypeData = Object.entries(svcByType).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Mileage leaders
    const mileage = vehicles.filter(v => v.current_odometer > 0).map(v => ({
      name: `${v.make} ${v.model}`,
      reg: v.registration_number,
      odometer: v.current_odometer,
    })).sort((a, b) => b.odometer - a.odometer).slice(0, 10);

    // Alerts
    const now2 = new Date();
    const licenseAlerts = vehicles.filter(v => {
      if (!v.license_disk_expiry || !v.is_active) return false;
      return (new Date(v.license_disk_expiry) - now2) / (1000 * 60 * 60 * 24) <= 30;
    });
    const serviceAlerts = vehicles.filter(v => {
      if (!v.next_service_date || !v.is_active) return false;
      return (new Date(v.next_service_date) - now2) / (1000 * 60 * 60 * 24) <= 30;
    });

    return { statusData, makeData, fuelData, monthlyCheckouts, fineTypeData, topDriverFines, serviceTypeData, mileage, licenseAlerts, serviceAlerts };
  }, [vehicles, checkouts, fines, services]);

  // Extended vehicle analytics (driver usage, trip distance, destinations, etc.)
  const vehicleDeep = useMemo(() => {
    const returned = checkouts.filter(co => co.is_returned && co.start_odometer > 0 && co.end_odometer > 0);

    // Trip distances
    const distances = returned.map(co => co.end_odometer - co.start_odometer).filter(d => d > 0);
    const totalKm = distances.reduce((s, d) => s + d, 0);
    const avgTripKm = distances.length > 0 ? Math.round(totalKm / distances.length) : 0;
    const maxTripKm = distances.length > 0 ? Math.max(...distances) : 0;

    // Trip durations (hours)
    const durations = returned.filter(co => co.return_date && co.checkout_date).map(co => {
      const hrs = (new Date(co.return_date) - new Date(co.checkout_date)) / (1000 * 60 * 60);
      return hrs > 0 ? hrs : null;
    }).filter(Boolean);
    const avgTripHrs = durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length * 10) / 10 : 0;

    // Who checks out which vehicle the most
    const driverVehicle = {};
    checkouts.forEach(co => {
      const driver = co.driver_name || 'Unknown';
      const veh = co.vehicles ? `${co.vehicles.make} ${co.vehicles.model} (${co.vehicles.registration_number})` : `Vehicle #${co.vehicle_id}`;
      const key = `${driver}|||${veh}`;
      if (!driverVehicle[key]) driverVehicle[key] = { driver, vehicle: veh, trips: 0, totalKm: 0 };
      driverVehicle[key].trips++;
      if (co.is_returned && co.start_odometer > 0 && co.end_odometer > 0) {
        const d = co.end_odometer - co.start_odometer;
        if (d > 0) driverVehicle[key].totalKm += d;
      }
    });
    const driverVehicleData = Object.values(driverVehicle).sort((a, b) => b.trips - a.trips).slice(0, 15);

    // Most active drivers overall
    const driverTrips = {};
    checkouts.forEach(co => {
      const driver = co.driver_name || 'Unknown';
      if (!driverTrips[driver]) driverTrips[driver] = { trips: 0, totalKm: 0, lastTrip: null };
      driverTrips[driver].trips++;
      if (co.is_returned && co.start_odometer > 0 && co.end_odometer > 0) {
        const d = co.end_odometer - co.start_odometer;
        if (d > 0) driverTrips[driver].totalKm += d;
      }
      const cd = new Date(co.checkout_date || co.created_at);
      if (!driverTrips[driver].lastTrip || cd > driverTrips[driver].lastTrip) driverTrips[driver].lastTrip = cd;
    });
    const topDrivers = Object.entries(driverTrips).map(([name, d]) => ({
      name, trips: d.trips, totalKm: d.totalKm, avgKm: d.trips > 0 && d.totalKm > 0 ? Math.round(d.totalKm / d.trips) : 0, lastTrip: d.lastTrip,
    })).sort((a, b) => b.trips - a.trips).slice(0, 10);

    // Top destinations
    const destCounts = {};
    checkouts.forEach(co => {
      const dest = (co.destination || '').trim();
      if (!dest) return;
      destCounts[dest] = (destCounts[dest] || 0) + 1;
    });
    const topDestinations = Object.entries(destCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

    // Per-vehicle usage
    const perVehicle = {};
    checkouts.forEach(co => {
      const vid = co.vehicle_id;
      const vLabel = co.vehicles ? `${co.vehicles.make} ${co.vehicles.model}` : `#${vid}`;
      const reg = co.vehicles?.registration_number || '';
      if (!perVehicle[vid]) perVehicle[vid] = { name: vLabel, reg, trips: 0, totalKm: 0, drivers: new Set() };
      perVehicle[vid].trips++;
      perVehicle[vid].drivers.add(co.driver_name || 'Unknown');
      if (co.is_returned && co.start_odometer > 0 && co.end_odometer > 0) {
        const d = co.end_odometer - co.start_odometer;
        if (d > 0) perVehicle[vid].totalKm += d;
      }
    });
    const vehicleUsage = Object.values(perVehicle).map(v => ({
      ...v, drivers: v.drivers.size, avgKm: v.trips > 0 && v.totalKm > 0 ? Math.round(v.totalKm / v.trips) : 0,
    })).sort((a, b) => b.trips - a.trips);

    // Trip distance distribution
    const distBuckets = { '0-50 km': 0, '50-100 km': 0, '100-200 km': 0, '200-500 km': 0, '500+ km': 0 };
    distances.forEach(d => {
      if (d < 50) distBuckets['0-50 km']++;
      else if (d < 100) distBuckets['50-100 km']++;
      else if (d < 200) distBuckets['100-200 km']++;
      else if (d < 500) distBuckets['200-500 km']++;
      else distBuckets['500+ km']++;
    });
    const distData = Object.entries(distBuckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

    // Reason for use breakdown
    const reasonCounts = {};
    checkouts.forEach(co => {
      const reason = (co.reason_for_use || '').trim();
      if (!reason) return;
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    const reasonData = Object.entries(reasonCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

    // Currently out (unreturned)
    const currentlyOut = checkouts.filter(co => !co.is_returned).length;

    return { totalKm, avgTripKm, maxTripKm, avgTripHrs, driverVehicleData, topDrivers, topDestinations, vehicleUsage, distData, reasonData, currentlyOut, returnedCount: returned.length };
  }, [checkouts]);

  // Cost breakdown
  const costData = useMemo(() => {
    const deviceCosts = [
      { name: 'Laptops', value: overviewStats.laptopDeviceCost },
      { name: 'Cellphones', value: overviewStats.phoneDeviceCost },
    ].filter(d => d.value > 0);

    const recurringCosts = [
      { name: 'Laptops (yearly)', value: overviewStats.laptopYearlyCost },
      { name: 'Cellphones (monthly)', value: overviewStats.phoneMonthlyCost * 12 },
    ].filter(d => d.value > 0);

    // Fines paid vs unpaid
    const finePaid = fines.filter(f => f.status === 'Paid').reduce((s, f) => s + (parseFloat(f.fine_amount) || 0), 0);
    const fineUnpaid = fines.filter(f => f.status === 'Unpaid').reduce((s, f) => s + (parseFloat(f.fine_amount) || 0), 0);
    const fineStatus = [
      { name: 'Paid', value: Math.round(finePaid * 100) / 100 },
      { name: 'Unpaid', value: Math.round(fineUnpaid * 100) / 100 },
    ].filter(d => d.value > 0);

    // Service costs
    const svcCost = services.reduce((s, sv) => s + (parseFloat(sv.cost) || 0), 0);

    // Warranty expiring soon (within 90 days)
    const now = new Date();
    const warrantyAlerts = [
      ...laptops.filter(l => l.laptop_status === 'Active' && l.warranty_end_date).map(l => {
        const days = (new Date(l.warranty_end_date) - now) / (1000 * 60 * 60 * 24);
        return days <= 90 && days > -30 ? { name: `${l.laptop_brand} ${l.laptop_model}`, type: 'Laptop', employee: l.employee_name, expiry: l.warranty_end_date, days: Math.round(days) } : null;
      }).filter(Boolean),
      ...cellphones.filter(c => c.phone_status === 'Active' && c.warranty_end_date).map(c => {
        const days = (new Date(c.warranty_end_date) - now) / (1000 * 60 * 60 * 24);
        return days <= 90 && days > -30 ? { name: `${c.phone_brand} ${c.phone_model}`, type: 'Cellphone', employee: c.employee_name, expiry: c.warranty_end_date, days: Math.round(days) } : null;
      }).filter(Boolean),
    ].sort((a, b) => a.days - b.days);

    // Insurance expiring
    const insuranceAlerts = [
      ...laptops.filter(l => l.laptop_status === 'Active' && l.insurance_expiry).map(l => {
        const days = (new Date(l.insurance_expiry) - now) / (1000 * 60 * 60 * 24);
        return days <= 90 && days > -30 ? { name: `${l.laptop_brand} ${l.laptop_model}`, type: 'Laptop', employee: l.employee_name, expiry: l.insurance_expiry, days: Math.round(days) } : null;
      }).filter(Boolean),
      ...cellphones.filter(c => c.phone_status === 'Active' && c.insurance_expiry).map(c => {
        const days = (new Date(c.insurance_expiry) - now) / (1000 * 60 * 60 * 24);
        return days <= 90 && days > -30 ? { name: `${c.phone_brand} ${c.phone_model}`, type: 'Cellphone', employee: c.employee_name, expiry: c.insurance_expiry, days: Math.round(days) } : null;
      }).filter(Boolean),
    ].sort((a, b) => a.days - b.days);

    // Contract expiring
    const contractAlerts = [
      ...laptops.filter(l => l.laptop_status === 'Active' && l.contract_end_date).map(l => {
        const days = (new Date(l.contract_end_date) - now) / (1000 * 60 * 60 * 24);
        return days <= 90 && days > -30 ? { name: `${l.laptop_brand} ${l.laptop_model}`, type: 'Laptop', employee: l.employee_name, expiry: l.contract_end_date, days: Math.round(days) } : null;
      }).filter(Boolean),
      ...cellphones.filter(c => c.phone_status === 'Active' && c.contract_end_date).map(c => {
        const days = (new Date(c.contract_end_date) - now) / (1000 * 60 * 60 * 24);
        return days <= 90 && days > -30 ? { name: `${c.phone_brand} ${c.phone_model}`, type: 'Cellphone', employee: c.employee_name, expiry: c.contract_end_date, days: Math.round(days) } : null;
      }).filter(Boolean),
    ].sort((a, b) => a.days - b.days);

    return { deviceCosts, recurringCosts, fineStatus, svcCost, warrantyAlerts, insuranceAlerts, contractAlerts };
  }, [laptops, cellphones, fines, services, overviewStats]);

  // ---- Render helpers ----

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA') : '-';
  const formatCurrency = (v) => `R${Number(v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const statusColor = (status) => {
    const map = { Active: '#2e7d32', 'In Use': '#1976d2', Available: '#2e7d32', Returned: '#455a64', Repairs: '#ed6c02', 'In Service': '#ed6c02', Damaged: '#d32f2f', Stolen: '#d32f2f', Lost: '#d32f2f', Decommissioned: '#9e9e9e', 'Written Off': '#9e9e9e', Sold: '#5d4037' };
    return map[status] || '#9e9e9e';
  };

  const renderPieDonut = (data, title, size) => {
    const outerR = size * 0.4;
    const innerR = outerR * 0.55;
    return (
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={innerR} outerRadius={outerR} paddingAngle={2} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: 'var(--text-secondary)', strokeWidth: 1 }} style={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // ---- TAB RENDERERS ----

  const renderOverview = () => (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Icons.Package size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{overviewStats.totalAssets}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Assets</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Icons.Check size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{overviewStats.totalActive}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Assets</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Icons.TrendingUp size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(overviewStats.totalDeviceCost)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Device Cost</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Icons.Calendar size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(overviewStats.totalAnnualRecurring)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Annual Recurring</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20 }}>
        {/* Asset Type Distribution */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Asset Distribution</h3></div>
          {renderPieDonut(assetDistribution, 'Assets', isMobile ? 240 : 280)}
        </div>

        {/* Active per type */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Active vs Inactive by Type</h3></div>
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
            <BarChart data={[
              { name: 'Laptops', Active: laptops.filter(l => l.laptop_status === 'Active').length, Inactive: laptops.filter(l => l.laptop_status !== 'Active').length },
              { name: 'Cellphones', Active: cellphones.filter(c => c.phone_status === 'Active').length, Inactive: cellphones.filter(c => c.phone_status !== 'Active').length },
              { name: 'Vehicles', Active: vehicles.filter(v => v.is_active).length, Inactive: vehicles.filter(v => !v.is_active).length },
            ]} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
              <YAxis allowDecimals={false} width={isMobile ? 30 : 40} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="Active" fill="#2e7d32" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Inactive" fill="#9e9e9e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts summary */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Alerts & Attention Needed</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            {laptopStats.upgradeStatus.Due > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(211,47,47,0.08)', borderRadius: 8 }}>
                <Icons.Warning size={18} style={{ color: '#d32f2f', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{laptopStats.upgradeStatus.Due} laptop{laptopStats.upgradeStatus.Due !== 1 ? 's' : ''} due for upgrade</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>4+ years old</div>
                </div>
              </div>
            )}
            {cellphoneStats.upgradeStatus.Due > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(211,47,47,0.08)', borderRadius: 8 }}>
                <Icons.Warning size={18} style={{ color: '#d32f2f', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{cellphoneStats.upgradeStatus.Due} cellphone{cellphoneStats.upgradeStatus.Due !== 1 ? 's' : ''} due for upgrade</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>2+ years old</div>
                </div>
              </div>
            )}
            {vehicleStats.licenseAlerts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(237,108,2,0.08)', borderRadius: 8 }}>
                <Icons.AlertCircle size={18} style={{ color: '#ed6c02', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{vehicleStats.licenseAlerts.length} vehicle license{vehicleStats.licenseAlerts.length !== 1 ? 's' : ''} expiring/expired</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Within 30 days</div>
                </div>
              </div>
            )}
            {vehicleStats.serviceAlerts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(237,108,2,0.08)', borderRadius: 8 }}>
                <Icons.Wrench size={18} style={{ color: '#ed6c02', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{vehicleStats.serviceAlerts.length} vehicle{vehicleStats.serviceAlerts.length !== 1 ? 's' : ''} service due</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Within 30 days</div>
                </div>
              </div>
            )}
            {overviewStats.unpaidFineCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(211,47,47,0.08)', borderRadius: 8 }}>
                <Icons.Warning size={18} style={{ color: '#d32f2f', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{overviewStats.unpaidFineCount} unpaid fine{overviewStats.unpaidFineCount !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Total: {formatCurrency(overviewStats.totalFines)}</div>
                </div>
              </div>
            )}
            {costData.warrantyAlerts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(237,108,2,0.08)', borderRadius: 8 }}>
                <Icons.Shield size={18} style={{ color: '#ed6c02', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{costData.warrantyAlerts.length} warranty{costData.warrantyAlerts.length !== 1 ? ' expiries' : ' expiry'} approaching</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Within 90 days</div>
                </div>
              </div>
            )}
            {laptopStats.upgradeStatus.Due === 0 && cellphoneStats.upgradeStatus.Due === 0 && vehicleStats.licenseAlerts.length === 0 && vehicleStats.serviceAlerts.length === 0 && overviewStats.unpaidFineCount === 0 && costData.warrantyAlerts.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>
                <Icons.Check size={28} style={{ color: '#2e7d32', marginBottom: 8 }} /><br />
                No alerts - all assets are in good standing
              </div>
            )}
          </div>
        </div>

        {/* Cost summary */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Cost Summary</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <span style={{ fontWeight: 500 }}>Laptop devices</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(overviewStats.laptopDeviceCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <span style={{ fontWeight: 500 }}>Cellphone devices</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(overviewStats.phoneDeviceCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <span style={{ fontWeight: 500 }}>Yearly (laptops)</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(overviewStats.laptopYearlyCost)}/yr</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <span style={{ fontWeight: 500 }}>Monthly (cellphones)</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(overviewStats.phoneMonthlyCost)}/mo</span>
            </div>
            {costData.svcCost > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <span style={{ fontWeight: 500 }}>Vehicle service costs</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(costData.svcCost)}</span>
              </div>
            )}
            {overviewStats.totalFines > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(211,47,47,0.06)', borderRadius: 8 }}>
                <span style={{ fontWeight: 500, color: '#d32f2f' }}>Unpaid fines</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#d32f2f' }}>{formatCurrency(overviewStats.totalFines)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderLaptops = () => (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Icons.Package size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{laptops.length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Laptops</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Icons.Check size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{laptops.filter(l => l.laptop_status === 'Active').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Icons.Warning size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{laptopStats.upgradeStatus.Due}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Upgrade Due (4+ yrs)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Icons.TrendingUp size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(overviewStats.laptopDeviceCost)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Device Cost</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20 }}>
        {/* Status breakdown */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Status Breakdown</h3></div>
          {renderPieDonut(laptopStats.statusData.map((d, i) => ({ ...d, fill: statusColor(d.name) })), 'Status', isMobile ? 240 : 280)}
        </div>

        {/* Brand distribution */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Brand Distribution</h3></div>
          <ResponsiveContainer width="100%" height={Math.max(180, laptopStats.brandData.length * 32 + 40)}>
            <BarChart data={laptopStats.brandData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} width={yAxisWidth} tickFormatter={truncLabel} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Count" fill="#1976d2" radius={[0, 4, 4, 0]}>
                {laptopStats.brandData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Upgrade status */}
        {laptopStats.upgradeData.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Upgrade Status (Active Laptops)</h3></div>
            {renderPieDonut(laptopStats.upgradeData.map(d => ({
              ...d,
              fill: d.name === 'Due' ? '#d32f2f' : d.name === 'Approaching' ? '#ed6c02' : '#2e7d32',
            })), 'Upgrade', isMobile ? 220 : 260)}
          </div>
        )}

        {/* Oldest active laptops */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Oldest Active Laptops</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>By assignment age</span>
          </div>
          {(() => {
            const oldest = laptops.filter(l => l.laptop_status === 'Active' && l.date_assigned)
              .map(l => ({ ...l, months: ageMonths(l.date_assigned) }))
              .sort((a, b) => b.months - a.months)
              .slice(0, 10);
            return oldest.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No active assignments</p>
            ) : (
              <div className="table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="equipment-table">
                  <thead><tr><th>Employee</th><th>Device</th><th>Assigned</th><th>Age</th></tr></thead>
                  <tbody>
                    {oldest.map((l, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{l.employee_name}</td>
                        <td>{l.laptop_brand} {l.laptop_model}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(l.date_assigned)}</td>
                        <td>
                          <span className="badge" style={{ background: l.months >= 48 ? '#d32f2f' : l.months >= 36 ? '#ed6c02' : '#2e7d32', fontSize: '0.7rem' }}>
                            {formatAge(l.months)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  const renderCellphones = () => (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Icons.Phone size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{cellphones.length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Cellphones</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Icons.Check size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{cellphones.filter(c => c.phone_status === 'Active').length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Icons.Warning size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{cellphoneStats.upgradeStatus.Due}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Upgrade Due (2+ yrs)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Icons.TrendingUp size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(overviewStats.phoneDeviceCost)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Device Cost</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20 }}>
        {/* Status breakdown */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Status Breakdown</h3></div>
          {renderPieDonut(cellphoneStats.statusData.map(d => ({ ...d, fill: statusColor(d.name) })), 'Status', isMobile ? 240 : 280)}
        </div>

        {/* Brand distribution */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Brand Distribution</h3></div>
          <ResponsiveContainer width="100%" height={Math.max(180, cellphoneStats.brandData.length * 32 + 40)}>
            <BarChart data={cellphoneStats.brandData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} width={yAxisWidth} tickFormatter={truncLabel} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Count" fill="#9c27b0" radius={[0, 4, 4, 0]}>
                {cellphoneStats.brandData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Network provider distribution */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Network Provider</h3></div>
          {renderPieDonut(cellphoneStats.networkData, 'Network', isMobile ? 220 : 260)}
        </div>

        {/* Upgrade status */}
        {cellphoneStats.upgradeData.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Upgrade Status (Active Cellphones)</h3></div>
            {renderPieDonut(cellphoneStats.upgradeData.map(d => ({
              ...d,
              fill: d.name === 'Due' ? '#d32f2f' : d.name === 'Approaching' ? '#ed6c02' : '#2e7d32',
            })), 'Upgrade', isMobile ? 220 : 260)}
          </div>
        )}

        {/* Oldest active cellphones */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Oldest Active Cellphones</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>By assignment age</span>
          </div>
          {(() => {
            const oldest = cellphones.filter(c => c.phone_status === 'Active' && c.date_assigned)
              .map(c => ({ ...c, months: ageMonths(c.date_assigned) }))
              .sort((a, b) => b.months - a.months)
              .slice(0, 10);
            return oldest.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No active assignments</p>
            ) : (
              <div className="table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="equipment-table">
                  <thead><tr><th>Employee</th><th>Device</th><th>Network</th><th>Age</th></tr></thead>
                  <tbody>
                    {oldest.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{c.employee_name}</td>
                        <td>{c.phone_brand} {c.phone_model}</td>
                        <td>{c.network_provider || '-'}</td>
                        <td>
                          <span className="badge" style={{ background: c.months >= 24 ? '#d32f2f' : c.months >= 18 ? '#ed6c02' : '#2e7d32', fontSize: '0.7rem' }}>
                            {formatAge(c.months)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  const renderVehicles = () => (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Icons.Package size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{vehicles.length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Fleet</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Icons.Check size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{checkouts.length}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Trips</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Icons.TrendingUp size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{vehicleDeep.totalKm.toLocaleString()} km</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Distance</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Icons.MapPin size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{vehicleDeep.avgTripKm.toLocaleString()} km</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Avg Trip Distance</div>
          </div>
        </div>
      </div>

      {/* Secondary stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{vehicleDeep.currentlyOut}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Currently Out</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{vehicleDeep.avgTripHrs}h</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Avg Trip Duration</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{vehicleDeep.maxTripKm.toLocaleString()} km</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Longest Trip</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fines.length}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Total Fines</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20 }}>
        {/* Driver-Vehicle affinity - who uses which vehicle most */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Who Uses Which Vehicle Most</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Top 15</span>
          </div>
          {vehicleDeep.driverVehicleData.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No checkout data</p>
          ) : (
            <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="equipment-table">
                <thead><tr><th>Driver</th><th>Vehicle</th><th>Trips</th><th>Total km</th></tr></thead>
                <tbody>
                  {vehicleDeep.driverVehicleData.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{d.driver}</td>
                      <td style={{ fontSize: '0.83rem' }}>{d.vehicle}</td>
                      <td style={{ fontWeight: 600 }}>{d.trips}</td>
                      <td style={{ fontFamily: 'monospace' }}>{d.totalKm > 0 ? `${d.totalKm.toLocaleString()}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Most active drivers */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Most Active Drivers</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>By trip count</span>
          </div>
          {vehicleDeep.topDrivers.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No checkout data</p>
          ) : (
            <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="equipment-table">
                <thead><tr><th>Driver</th><th>Trips</th><th>Total km</th><th>Avg km</th><th>Last Trip</th></tr></thead>
                <tbody>
                  {vehicleDeep.topDrivers.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td style={{ fontWeight: 600 }}>{d.trips}</td>
                      <td style={{ fontFamily: 'monospace' }}>{d.totalKm > 0 ? d.totalKm.toLocaleString() : '-'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{d.avgKm > 0 ? d.avgKm.toLocaleString() : '-'}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{d.lastTrip ? formatDate(d.lastTrip) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Per-vehicle usage */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Vehicle Usage Breakdown</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>All vehicles</span>
          </div>
          {vehicleDeep.vehicleUsage.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No checkout data</p>
          ) : (
            <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="equipment-table">
                <thead><tr><th>Vehicle</th><th>Reg</th><th>Trips</th><th>Total km</th><th>Avg km</th><th>Drivers</th></tr></thead>
                <tbody>
                  {vehicleDeep.vehicleUsage.map((v, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{v.name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.83rem' }}>{v.reg}</td>
                      <td style={{ fontWeight: 600 }}>{v.trips}</td>
                      <td style={{ fontFamily: 'monospace' }}>{v.totalKm > 0 ? v.totalKm.toLocaleString() : '-'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{v.avgKm > 0 ? v.avgKm.toLocaleString() : '-'}</td>
                      <td>{v.drivers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Trip distance distribution */}
        {vehicleDeep.distData.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Trip Distance Distribution</h3></div>
            <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
              <BarChart data={vehicleDeep.distData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{ fontSize: isMobile ? 9 : 11 }} />
                <YAxis allowDecimals={false} width={isMobile ? 30 : 40} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Trips" fill="#1976d2" radius={[4, 4, 0, 0]}>
                  {vehicleDeep.distData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top destinations */}
        {vehicleDeep.topDestinations.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Top Destinations</h3></div>
            <ResponsiveContainer width="100%" height={Math.max(180, vehicleDeep.topDestinations.length * 32 + 40)}>
              <BarChart data={vehicleDeep.topDestinations} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} width={yAxisWidth} tickFormatter={truncLabel} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Trips" fill="#00796b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Reason for use */}
        {vehicleDeep.reasonData.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Reason for Use</h3></div>
            {renderPieDonut(vehicleDeep.reasonData, 'Reasons', isMobile ? 240 : 280)}
          </div>
        )}

        {/* Checkout frequency */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Checkout Frequency (12 Months)</h3></div>
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
            <LineChart data={vehicleStats.monthlyCheckouts} margin={{ top: 5, right: 20, left: 0, bottom: isMobile ? 20 : 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="label" tick={{ fontSize: isMobile ? 9 : 11 }} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 50 : 30} interval={isMobile ? 1 : 0} />
              <YAxis allowDecimals={false} width={isMobile ? 30 : 40} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="checkouts" name="Checkouts" stroke="#1976d2" strokeWidth={2} dot={{ fill: '#1976d2', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Fleet status */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Fleet Status</h3></div>
          {renderPieDonut(vehicleStats.statusData.map(d => ({ ...d, fill: statusColor(d.name) })), 'Status', isMobile ? 240 : 280)}
        </div>

        {/* Make distribution */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Fleet by Make</h3></div>
          <ResponsiveContainer width="100%" height={Math.max(180, vehicleStats.makeData.length * 32 + 40)}>
            <BarChart data={vehicleStats.makeData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} width={yAxisWidth} tickFormatter={truncLabel} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Vehicles" fill="#00796b" radius={[0, 4, 4, 0]}>
                {vehicleStats.makeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fuel type */}
        {vehicleStats.fuelData.length > 1 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Fuel Type</h3></div>
            {renderPieDonut(vehicleStats.fuelData, 'Fuel', isMobile ? 220 : 260)}
          </div>
        )}

        {/* Fines by type */}
        {vehicleStats.fineTypeData.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Fines by Type</h3></div>
            <ResponsiveContainer width="100%" height={Math.max(180, vehicleStats.fineTypeData.length * 36 + 40)}>
              <BarChart data={vehicleStats.fineTypeData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `R${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} width={yAxisWidth} tickFormatter={truncLabel} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Fine Amount" fill="#d32f2f" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top fined drivers */}
        {vehicleStats.topDriverFines.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Top Fined Drivers</h3></div>
            <div className="table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
              <table className="equipment-table">
                <thead><tr><th>Driver</th><th>Fines</th><th>Total</th></tr></thead>
                <tbody>
                  {vehicleStats.topDriverFines.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td>{d.count}</td>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace', color: '#d32f2f' }}>{formatCurrency(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Service type breakdown */}
        {vehicleStats.serviceTypeData.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Service Types</h3></div>
            {renderPieDonut(vehicleStats.serviceTypeData, 'Services', isMobile ? 220 : 260)}
          </div>
        )}

        {/* Mileage leaders */}
        {vehicleStats.mileage.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Highest Mileage</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>By odometer</span>
            </div>
            <div className="table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
              <table className="equipment-table">
                <thead><tr><th>Vehicle</th><th>Reg</th><th>Odometer</th></tr></thead>
                <tbody>
                  {vehicleStats.mileage.map((v, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{v.name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{v.reg}</td>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{v.odometer.toLocaleString()} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCosts = () => (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Icons.TrendingUp size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(overviewStats.totalDeviceCost)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Device Investment</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Icons.Calendar size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(overviewStats.phoneMonthlyCost)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cellphone Monthly</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Icons.TrendingUp size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(overviewStats.totalAnnualRecurring)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Annual Recurring</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(211,47,47,0.12)', color: '#d32f2f' }}><Icons.Warning size={24} /></div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(overviewStats.totalFines)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Outstanding Fines</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20 }}>
        {/* Device cost split */}
        {costData.deviceCosts.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Device Cost Split</h3></div>
            {renderPieDonut(costData.deviceCosts, 'Device Cost', isMobile ? 240 : 280)}
          </div>
        )}

        {/* Recurring cost split (annualised) */}
        {costData.recurringCosts.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Annual Recurring Split</h3></div>
            {renderPieDonut(costData.recurringCosts, 'Annual', isMobile ? 240 : 280)}
          </div>
        )}

        {/* Fine status */}
        {costData.fineStatus.length > 0 && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Fine Status</h3></div>
            {renderPieDonut(costData.fineStatus.map(d => ({ ...d, fill: d.name === 'Paid' ? '#2e7d32' : '#d32f2f' })), 'Fines', isMobile ? 220 : 260)}
          </div>
        )}

        {/* Warranty alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Warranty Expiring</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Within 90 days</span>
          </div>
          {costData.warrantyAlerts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: 12 }}>No warranties expiring soon</p>
          ) : (
            <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table className="equipment-table">
                <thead><tr><th>Device</th><th>Type</th><th>Employee</th><th>Expiry</th><th>Days</th></tr></thead>
                <tbody>
                  {costData.warrantyAlerts.map((w, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{w.name}</td>
                      <td>{w.type}</td>
                      <td>{w.employee}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(w.expiry)}</td>
                      <td>
                        <span className="badge" style={{ background: w.days <= 0 ? '#d32f2f' : w.days <= 30 ? '#ed6c02' : '#9e9e9e', fontSize: '0.7rem' }}>
                          {w.days <= 0 ? 'EXPIRED' : `${w.days}d`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Insurance alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Insurance Expiring</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Within 90 days</span>
          </div>
          {costData.insuranceAlerts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: 12 }}>No insurance expiring soon</p>
          ) : (
            <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table className="equipment-table">
                <thead><tr><th>Device</th><th>Type</th><th>Employee</th><th>Expiry</th><th>Days</th></tr></thead>
                <tbody>
                  {costData.insuranceAlerts.map((w, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{w.name}</td>
                      <td>{w.type}</td>
                      <td>{w.employee}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(w.expiry)}</td>
                      <td>
                        <span className="badge" style={{ background: w.days <= 0 ? '#d32f2f' : w.days <= 30 ? '#ed6c02' : '#9e9e9e', fontSize: '0.7rem' }}>
                          {w.days <= 0 ? 'EXPIRED' : `${w.days}d`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Contract expiry */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Contracts Expiring</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Within 90 days</span>
          </div>
          {costData.contractAlerts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: 12 }}>No contracts expiring soon</p>
          ) : (
            <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table className="equipment-table">
                <thead><tr><th>Device</th><th>Type</th><th>Employee</th><th>Expiry</th><th>Days</th></tr></thead>
                <tbody>
                  {costData.contractAlerts.map((w, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{w.name}</td>
                      <td>{w.type}</td>
                      <td>{w.employee}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(w.expiry)}</td>
                      <td>
                        <span className="badge" style={{ background: w.days <= 0 ? '#d32f2f' : w.days <= 30 ? '#ed6c02' : '#9e9e9e', fontSize: '0.7rem' }}>
                          {w.days <= 0 ? 'EXPIRED' : `${w.days}d`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ---- Tab Content Router ----

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'laptops': return renderLaptops();
      case 'cellphones': return renderCellphones();
      case 'vehicles': return renderVehicles();
      case 'costs': return renderCosts();
      default: return null;
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading asset analytics...</div>;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        Error loading analytics: {error}
        <button className="btn btn-sm btn-secondary" onClick={fetchAllData} style={{ marginLeft: 'auto' }}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Analytics</h1>
          <p className="page-subtitle">Laptops, cellphones, vehicles - distribution, costs, lifecycle and alerts</p>
        </div>
        <div className="btn-group-wrap">
          <button className="btn btn-secondary" onClick={fetchAllData}><Icons.Refresh size={14} /> Refresh</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`tab ${activeTab === 'laptops' ? 'active' : ''}`} onClick={() => setActiveTab('laptops')}>
          Laptops
        </button>
        <button className={`tab ${activeTab === 'cellphones' ? 'active' : ''}`} onClick={() => setActiveTab('cellphones')}>
          Cellphones
        </button>
        <button className={`tab ${activeTab === 'vehicles' ? 'active' : ''}`} onClick={() => setActiveTab('vehicles')}>
          Vehicles
        </button>
        <button className={`tab ${activeTab === 'costs' ? 'active' : ''}`} onClick={() => setActiveTab('costs')}>
          Costs & Lifecycle
        </button>
      </div>

      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default AssetAnalytics;

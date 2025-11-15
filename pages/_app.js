import React, { useState, useEffect } from "react";
import {
  Calendar,
  Truck,
  Package,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  Loader,
} from "lucide-react";

// Supabase configuration
const SUPABASE_URL = "https://jfegvkzglxwlmbdmekpz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZWd2a3pnbHh3bG1iZG1la3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTQwNzUsImV4cCI6MjA3ODczMDA3NX0.6A8T1fTtrmQspl8RhZ00DwUxPpL_5Rcq23QQvjXVE8s";

const DRIVERS = ["Driver 1", "Driver 2", "Driver 3", "Unassigned"];

export default function SkipHireApp() {
  const [currentView, setCurrentView] = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingFormType, setBookingFormType] = useState("standard");
  const [loading, setLoading] = useState(true);

  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    phone: "",
    address: "",
    postcode: "",
  });

  const [formData, setFormData] = useState({
    skipSize: "",
    bookingType: "Standard Hire",
    placement: "Private Land",
    council: "",
    deliveryDate: "",
    deliverySlot: "All Day",
    customPrice: "",
    customSkipSize: "",
    notes: "",
  });

  const [availableSkips, setAvailableSkips] = useState([]);
  const [selectedSkipPrice, setSelectedSkipPrice] = useState(0);
  const [permitPrice, setPermitPrice] = useState(0);
  const VAT_RATE = 0.2;

  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cardReceiptNumber, setCardReceiptNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Supabase helper
  const supabaseFetch = async (table, options = {}) => {
    const { method = "GET", body, select = "*", filters = {} } = options;

    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    if (method === "GET") {
      url += `?select=${select}`;
      Object.entries(filters).forEach(([key, value]) => {
        url += `&${key}=eq.${value}`;
      });
    }

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const response = await fetch(url, config);
    if (!response.ok) {
      throw new Error(`Supabase error: ${response.statusText}`);
    }
    return method === "DELETE" ? null : response.json();
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const customersData = await supabaseFetch("customers", { select: "*" });
      setCustomers(
        customersData.map((c) => ({
          id: c.id,
          firstName: c.first_name,
          lastName: c.last_name,
          company: c.company || "",
          email: c.email,
          phone: c.phone,
          address: c.address,
          postcode: c.postcode,
        }))
      );

      const bookingsData = await supabaseFetch("bookings", { select: "*" });
      setBookings(
        bookingsData.map((b) => ({
          id: b.id,
          jobNo: b.job_no,
          bookingDate: b.booking_date,
          customerFirstName: b.customer_first_name,
          customerLastName: b.customer_last_name,
          companyName: b.company_name,
          email: b.email,
          phone: b.phone,
          address: b.address,
          postcode: b.postcode,
          skipSize: b.skip_size,
          bookingType: b.booking_type,
          placement: b.placement,
          council: b.council,
          deliveryDate: b.delivery_date,
          deliverySlot: b.delivery_slot,
          baseSkipPrice: parseFloat(b.base_skip_price),
          skipVAT: parseFloat(b.skip_vat),
          permitPrice: parseFloat(b.permit_price),
          totalExVAT: parseFloat(b.total_ex_vat),
          totalIncVAT: parseFloat(b.total_inc_vat),
          paymentMethod: b.payment_method,
          paymentStatus: b.payment_status,
          cardReceiptNumber: b.card_receipt_number,
          paymentNotes: b.payment_notes,
          deliveryStatus: b.delivery_status,
          collectionStatus: b.collection_status,
          onHireStart: b.on_hire_start,
          onHireEnd: b.on_hire_end,
          driverAssigned: b.driver_assigned,
          notes: b.notes,
        }))
      );
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Error loading data from database");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getFilteredCustomers = () => {
    if (!customerSearch) return [];
    const search = customerSearch.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.firstName.toLowerCase().includes(search) ||
          c.lastName.toLowerCase().includes(search) ||
          c.company.toLowerCase().includes(search) ||
          c.postcode.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search)
      )
      .slice(0, 5);
  };

  const handleSelectCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(
      `${customer.firstName} ${customer.lastName}${
        customer.company ? ` (${customer.company})` : ""
      }`
    );

    if (bookingFormType === "standard" && customer.postcode) {
      await loadPostcodePricing(customer.postcode);
    }
  };

  const loadPostcodePricing = async (postcode) => {
    if (!postcode || postcode.length < 4) {
      setAvailableSkips([]);
      return;
    }

    const upperPostcode = postcode.toUpperCase();
    const noSpaces = upperPostcode.replace(/\s+/g, "");
    const areaMatch = noSpaces.match(/^([A-Z]{1,2}\d{1,2})(\d)?/);

    if (!areaMatch) {
      setAvailableSkips([]);
      return;
    }

    const area = areaMatch[1];
    const sector = areaMatch[2];
    const searchPrefix = sector ? `${area} ${sector}` : area;

    try {
      const pricing = await supabaseFetch("postcode_pricing", {
        select: "*",
      });

      const matches = pricing
        .filter((p) => p.prefix === searchPrefix && p.active)
        .map((p) => ({
          size: p.size,
          price: parseFloat(p.price),
          active: p.active,
        }));

      setAvailableSkips(matches);
    } catch (error) {
      console.error("Error loading pricing:", error);
      setAvailableSkips([]);
    }
  };

  const handleAddNewCustomer = async () => {
    if (
      !newCustomer.firstName ||
      !newCustomer.lastName ||
      !newCustomer.email ||
      !newCustomer.phone ||
      !newCustomer.address ||
      !newCustomer.postcode
    ) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const customerData = {
        first_name: newCustomer.firstName,
        last_name: newCustomer.lastName,
        company: newCustomer.company || "",
        email: newCustomer.email,
        phone: newCustomer.phone,
        address: newCustomer.address,
        postcode: newCustomer.postcode.toUpperCase(),
      };

      const [created] = await supabaseFetch("customers", {
        method: "POST",
        body: customerData,
      });

      const customer = {
        id: created.id,
        firstName: created.first_name,
        lastName: created.last_name,
        company: created.company || "",
        email: created.email,
        phone: created.phone,
        address: created.address,
        postcode: created.postcode,
      };

      setCustomers([...customers, customer]);
      setSelectedCustomer(customer);
      setCustomerSearch(
        `${customer.firstName} ${customer.lastName}${
          customer.company ? ` (${customer.company})` : ""
        }`
      );
      setShowNewCustomerForm(false);
      setNewCustomer({
        firstName: "",
        lastName: "",
        company: "",
        email: "",
        phone: "",
        address: "",
        postcode: "",
      });

      if (bookingFormType === "standard" && customer.postcode) {
        await loadPostcodePricing(customer.postcode);
      }

      alert("Customer added successfully!");
    } catch (error) {
      console.error("Error adding customer:", error);
      alert("Error adding customer to database: " + error.message);
    }
  };

  const openBookingForm = (type) => {
    setBookingFormType(type);
    setShowBookingForm(true);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setAvailableSkips([]);
    setSelectedSkipPrice(0);
    setFormData({
      skipSize: "",
      bookingType: "Standard Hire",
      placement: "Private Land",
      council: "",
      deliveryDate: "",
      deliverySlot: "All Day",
      customPrice: "",
      customSkipSize: "",
      notes: "",
    });
    setShowPaymentStep(false);
    setPaymentMethod("");
    setCardReceiptNumber("");
    setPaymentNotes("");
  };

  const handleSkipSizeChange = (size) => {
    const skip = availableSkips.find((s) => s.size === size);
    setFormData({ ...formData, skipSize: size });
    setSelectedSkipPrice(skip ? skip.price : 0);
  };

  useEffect(() => {
    if (formData.placement === "Council Permit") {
      setPermitPrice(75);
    } else {
      setPermitPrice(0);
    }
  }, [formData.placement]);

  const calculatePricing = () => {
    if (bookingFormType === "custom") {
      const basePrice = parseFloat(formData.customPrice) || 0;
      const vat = basePrice * VAT_RATE;
      const total = basePrice + vat;
      return {
        basePrice: basePrice,
        vat: vat,
        permitPrice: 0,
        totalExVat: basePrice,
        totalIncVat: total,
      };
    }

    const skipVat = selectedSkipPrice * VAT_RATE;
    const skipTotal = selectedSkipPrice + skipVat;
    const totalExVat = selectedSkipPrice + permitPrice;
    const totalIncVat = skipTotal + permitPrice;

    return {
      basePrice: selectedSkipPrice,
      vat: skipVat,
      permitPrice: permitPrice,
      totalExVat: totalExVat,
      totalIncVat: totalIncVat,
    };
  };

  const handleProceedToPayment = () => {
    if (!selectedCustomer) {
      alert("Please select a customer");
      return;
    }

    if (bookingFormType === "standard" && !formData.skipSize) {
      alert("Please select a skip size");
      return;
    }

    if (
      bookingFormType === "custom" &&
      (!formData.customSkipSize || !formData.customPrice)
    ) {
      alert("Please enter skip size and price");
      return;
    }

    if (!formData.deliveryDate) {
      alert("Please select a delivery date");
      return;
    }

    setShowPaymentStep(true);
  };

  const handleCreateBooking = async () => {
    if (!paymentMethod) {
      alert("Please select a payment method");
      return;
    }

    if (paymentMethod === "Card Over Phone" && !cardReceiptNumber) {
      alert("Please enter the card receipt number");
      return;
    }

    const pricing = calculatePricing();
    const jobNo = `JOB${Date.now()}`;

    try {
      const bookingData = {
        job_no: jobNo,
        booking_date: new Date().toISOString().split("T")[0],
        customer_id: selectedCustomer.id,
        customer_first_name: selectedCustomer.firstName,
        customer_last_name: selectedCustomer.lastName,
        company_name: selectedCustomer.company,
        email: selectedCustomer.email,
        phone: selectedCustomer.phone,
        address: selectedCustomer.address,
        postcode: selectedCustomer.postcode,
        skip_size:
          bookingFormType === "custom"
            ? formData.customSkipSize
            : formData.skipSize,
        booking_type:
          bookingFormType === "custom" ? "Custom" : formData.bookingType,
        placement: formData.placement,
        council: formData.council,
        delivery_date: formData.deliveryDate,
        delivery_slot: formData.deliverySlot,
        base_skip_price: pricing.basePrice,
        skip_vat: pricing.vat,
        permit_price: pricing.permitPrice,
        total_ex_vat: pricing.totalExVat,
        total_inc_vat: pricing.totalIncVat,
        payment_method: paymentMethod,
        payment_status:
          paymentMethod === "COD" || paymentMethod === "Call Back to Pay"
            ? "Awaiting Payment"
            : "Paid",
        card_receipt_number: cardReceiptNumber,
        payment_notes: paymentNotes,
        delivery_status: "Scheduled",
        collection_status: "Awaiting Collection Request",
        driver_assigned: "Unassigned",
        notes: formData.notes,
      };

      await supabaseFetch("bookings", {
        method: "POST",
        body: bookingData,
      });

      await loadData();

      setShowBookingForm(false);
      setShowPaymentStep(false);
      setSelectedCustomer(null);
      setCustomerSearch("");
      setAvailableSkips([]);
      setSelectedSkipPrice(0);
      setPaymentMethod("");
      setCardReceiptNumber("");
      setPaymentNotes("");

      alert("Booking created successfully!");
    } catch (error) {
      console.error("Error creating booking:", error);
      alert("Error creating booking in database");
    }
  };

  const updateBooking = async (id, updates) => {
    try {
      await supabaseFetch(`bookings?id=eq.${id}`, {
        method: "PATCH",
        body: updates,
      });
      await loadData();
    } catch (error) {
      console.error("Error updating booking:", error);
      alert("Error updating booking");
    }
  };

  const markAsDelivered = (booking) => {
    updateBooking(booking.id, {
      delivery_status: "Delivered",
      on_hire_start: new Date().toISOString().split("T")[0],
    });
  };

  const requestCollection = (booking) => {
    updateBooking(booking.id, {
      collection_status: "Collection Requested",
    });
  };

  const markAsCollected = (booking) => {
    updateBooking(booking.id, {
      collection_status: "Collected",
      on_hire_end: new Date().toISOString().split("T")[0],
    });
  };

  const assignDriver = (booking, driver) => {
    updateBooking(booking.id, {
      driver_assigned: driver,
    });
  };

  const getTodaysDeliveries = () => {
    const today = new Date().toISOString().split("T")[0];
    return bookings.filter((b) => b.deliveryDate === today);
  };

  const getCollectionRequests = () => {
    return bookings.filter(
      (b) => b.collectionStatus === "Collection Requested"
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-gray-600">Loading from database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white p-4">
        <h1 className="text-xl font-bold mb-8">Skip Hire Pro</h1>

        <nav className="space-y-2">
          <button
            onClick={() => setCurrentView("bookings")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${
              currentView === "bookings" ? "bg-blue-600" : "hover:bg-gray-800"
            }`}
          >
            <Package size={20} />
            <span>Skip Hire Jobs</span>
          </button>

          <button
            onClick={() => setCurrentView("scheduler")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${
              currentView === "scheduler" ? "bg-blue-600" : "hover:bg-gray-800"
            }`}
          >
            <Calendar size={20} />
            <span>Daily Scheduler</span>
          </button>

          <button
            onClick={() => setCurrentView("collections")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${
              currentView === "collections"
                ? "bg-blue-600"
                : "hover:bg-gray-800"
            }`}
          >
            <Truck size={20} />
            <span>Collection Requests</span>
          </button>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white shadow-sm border-b px-8 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-800">
              {currentView === "bookings" && "Skip Hire Jobs"}
              {currentView === "scheduler" && "Daily Scheduler"}
              {currentView === "collections" && "Collection Requests"}
            </h2>
            {currentView === "bookings" && (
              <div className="flex space-x-3">
                <button
                  onClick={() => openBookingForm("standard")}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  + New Standard Booking
                </button>
                <button
                  onClick={() => openBookingForm("custom")}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
                >
                  + New Custom Booking
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-8">
          {/* BOOKINGS VIEW */}
          {currentView === "bookings" && (
            <div className="space-y-4">
              {bookings.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  No bookings yet. Click "New Standard Booking" or "New Custom Booking"
                  to create one.
                </div>
              ) : (
                bookings.map((booking) => (
                  <div key={booking.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded">
                            {booking.jobNo}
                          </span>
                          <span
                            className={`px-3 py-1 rounded text-sm ${
                              booking.deliveryStatus === "Delivered"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {booking.deliveryStatus}
                          </span>
                          <span
                            className={`px-3 py-1 rounded text-sm ${
                              booking.paymentStatus === "Paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {booking.paymentStatus}
                          </span>
                          <span
                            className={`px-3 py-1 rounded text-sm ${
                              booking.collectionStatus === "Collected"
                                ? "bg-green-100 text-green-800"
                                : booking.collectionStatus ===
                                  "Collection Requested"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {booking.collectionStatus}
                          </span>
                        </div>

                        <h3 className="text-lg font-semibold mb-2">
                          {booking.customerFirstName} {booking.customerLastName}
                          {booking.companyName && ` (${booking.companyName})`}
                        </h3>

                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <MapPin size={16} />
                            <span>
                              {booking.address}, {booking.postcode}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Phone size={16} />
                            <span>{booking.phone}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Mail size={16} />
                            <span>{booking.email}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar size={16} />
                            <span>
                              Delivery: {booking.deliveryDate} (
                              {booking.deliverySlot})
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Package size={16} />
                            <span>
                              {booking.skipSize} Skip - {booking.bookingType}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Truck size={16} />
                            <span>Driver: {booking.driverAssigned}</span>
                          </div>
                        </div>

                        <div className="mt-3 text-sm">
                          <span className="font-semibold">
                            Total: £{booking.totalIncVAT.toFixed(2)}
                          </span>
                          <span className="ml-2 text-gray-600">
                            (Ex VAT: £{booking.totalExVAT.toFixed(2)})
                          </span>
                          <span className="ml-4 text-blue-600">
                            Payment: {booking.paymentMethod}
                          </span>
                          {booking.cardReceiptNumber && (
                            <span className="ml-2 text-gray-600">
                              (Receipt: {booking.cardReceiptNumber})
                            </span>
                          )}
                          {booking.placement === "Council Permit" && (
                            <span className="ml-4 text-orange-600">
                              (Includes £{booking.permitPrice.toFixed(2)} permit
                              - No VAT)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col space-y-2">
                        {booking.deliveryStatus === "Scheduled" && (
                          <button
                            onClick={() => markAsDelivered(booking)}
                            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                          >
                            Mark Delivered
                          </button>
                        )}
                        {booking.deliveryStatus === "Delivered" &&
                          booking.collectionStatus ===
                            "Awaiting Collection Request" && (
                            <button
                              onClick={() => requestCollection(booking)}
                              className="bg-orange-600 text-white px-4 py-2 rounded text-sm hover:bg-orange-700"
                            >
                              Request Collection
                            </button>
                          )}
                        {booking.collectionStatus ===
                          "Collection Requested" && (
                          <button
                            onClick={() => markAsCollected(booking)}
                            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                          >
                            Mark Collected
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SCHEDULER VIEW */}
          {currentView === "scheduler" && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Today's Deliveries
                </h3>
                {getTodaysDeliveries().length === 0 ? (
                  <p className="text-gray-500">
                    No deliveries scheduled for today.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {getTodaysDeliveries().map((booking) => (
                      <div
                        key={booking.id}
                        className="border-l-4 border-blue-500 bg-gray-50 p-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold">
                              {booking.customerFirstName}{" "}
                              {booking.customerLastName}
                            </div>
                            <div className="text-sm text-gray-600">
                              {booking.address}, {booking.postcode}
                            </div>
                            <div className="text-sm text-gray-600">
                              {booking.skipSize} - {booking.deliverySlot}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <select
                              value={booking.driverAssigned}
                              onChange={(e) =>
                                assignDriver(booking, e.target.value)
                              }
                              className="border rounded px-3 py-1 text-sm"
                            >
                              {DRIVERS.map((driver) => (
                                <option key={driver} value={driver}>
                                  {driver}
                                </option>
                              ))}
                            </select>
                            {booking.deliveryStatus === "Scheduled" && (
                              <button
                                onClick={() => markAsDelivered(booking)}
                                className="w-full bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                              >
                                Mark Delivered
                              </button>
                            )}
                            {booking.deliveryStatus === "Delivered" && (
                              <span className="flex items-center text-green-600 text-sm">
                                <CheckCircle size={16} className="mr-1" />
                                Delivered
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COLLECTIONS VIEW */}
          {currentView === "collections" && (
            <div className="space-y-4">
              {getCollectionRequests().length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  No collection requests at the moment.
                </div>
              ) : (
                getCollectionRequests().map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white rounded-lg shadow p-6"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg mb-2">
                          {booking.customerFirstName} {booking.customerLastName}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div>
                            {booking.address}, {booking.postcode}
                          </div>
                          <div>Skip: {booking.skipSize}</div>
                          <div>Delivered: {booking.onHireStart}</div>
                          <div>Driver: {booking.driverAssigned}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => markAsCollected(booking)}
                        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
                      >
                        Mark Collected
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOOKING FORM MODAL */}
      {showBookingForm && !showPaymentStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6">
                {bookingFormType === "standard"
                  ? "New Standard Booking"
                  : "New Custom Booking"}
              </h2>

              <div className="space-y-4">
                {/* Customer search / selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Customer *
                  </label>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      if (!e.target.value) setSelectedCustomer(null);
                    }}
                    placeholder="Search by name, company, postcode..."
                    className="w-full border rounded px-3 py-2"
                  />

                  {customerSearch &&
                    !selectedCustomer &&
                    getFilteredCustomers().length > 0 && (
                      <div className="mt-2 border rounded shadow-lg bg-white">
                        {getFilteredCustomers().map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => handleSelectCustomer(customer)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                          >
                            <div className="font-semibold">
                              {customer.firstName} {customer.lastName}
                              {customer.company && (
                                <span className="text-gray-600">
                                  {" "}
                                  ({customer.company})
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              {customer.address}, {customer.postcode}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                  {customerSearch &&
                    !selectedCustomer &&
                    getFilteredCustomers().length === 0 && (
                      <button
                        onClick={() => setShowNewCustomerForm(true)}
                        className="mt-2 w-full bg-green-50 text-green-700 border border-green-300 px-4 py-2 rounded hover:bg-green-100"
                      >
                        + Add New Customer
                      </button>
                    )}

                  {selectedCustomer && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold">
                            {selectedCustomer.firstName}{" "}
                            {selectedCustomer.lastName}
                            {selectedCustomer.company && (
                              <span className="text-gray-600">
                                {" "}
                                ({selectedCustomer.company})
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {selectedCustomer.address},{" "}
                            {selectedCustomer.postcode}
                          </div>
                          <div className="text-sm text-gray-600">
                            {selectedCustomer.email} • {selectedCustomer.phone}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCustomer(null);
                            setCustomerSearch("");
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Booking details */}
                {bookingFormType === "standard" && selectedCustomer && (
                  <>
                    {availableSkips.length > 0 ? (
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Skip Size *
                        </label>
                        <select
                          value={formData.skipSize}
                          onChange={(e) => handleSkipSizeChange(e.target.value)}
                          className="w-full border rounded px-3 py-2"
                        >
                          <option value="">Select skip size</option>
                          {availableSkips.map((skip) => (
                            <option key={skip.size} value={skip.size}>
                              {skip.size} - £{skip.price.toFixed(2)} + VAT (£
                              {(skip.price * 1.2).toFixed(2)} inc VAT)
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                        No skip pricing found for postcode{" "}
                        {selectedCustomer.postcode}. Please use Custom Booking
                        instead.
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Booking Type *
                      </label>
                      <select
                        value={formData.bookingType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bookingType: e.target.value,
                          })
                        }
                        className="w-full border rounded px-3 py-2"
                      >
                        <option>Standard Hire</option>
                        <option>Wait and Load</option>
                      </select>
                    </div>
                  </>
                )}

                {bookingFormType === "custom" && selectedCustomer && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Skip Size / Description *
                      </label>
                      <input
                        type="text"
                        value={formData.customSkipSize}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customSkipSize: e.target.value,
                          })
                        }
                        placeholder="e.g., 12 yard Cardboard Only"
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Price (£) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.customPrice}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customPrice: e.target.value,
                          })
                        }
                        placeholder="0.00"
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </>
                )}

                {selectedCustomer && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Placement *
                        </label>
                        <select
                          value={formData.placement}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              placement: e.target.value,
                            })
                          }
                          className="w-full border rounded px-3 py-2"
                        >
                          <option>Private Land</option>
                          <option>Council Permit</option>
                        </select>
                      </div>

                      {formData.placement === "Council Permit" && (
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Council
                          </label>
                          <input
                            type="text"
                            value={formData.council}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                council: e.target.value,
                              })
                            }
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Delivery Date *
                        </label>
                        <input
                          type="date"
                          value={formData.deliveryDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              deliveryDate: e.target.value,
                            })
                          }
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Delivery Slot
                        </label>
                        <select
                          value={formData.deliverySlot}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              deliverySlot: e.target.value,
                            })
                          }
                          className="w-full border rounded px-3 py-2"
                        >
                          <option>All Day</option>
                          <option>AM</option>
                          <option>PM</option>
                        </select>
                      </div>
                    </div>

                    {/* Pricing Summary */}
                    <div className="bg-gray-50 p-4 rounded">
                      {bookingFormType === "standard" && (
                        <>
                          <div className="flex justify-between mb-2">
                            <span>Skip Hire (Ex VAT):</span>
                            <span className="font-semibold">
                              £{selectedSkipPrice.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between mb-2 text-sm text-gray-600">
                            <span>VAT @ 20%:</span>
                            <span>
                              £{(selectedSkipPrice * VAT_RATE).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between mb-2">
                            <span>Skip Hire (Inc VAT):</span>
                            <span className="font-semibold">
                              £
                              {(
                                selectedSkipPrice +
                                selectedSkipPrice * VAT_RATE
                              ).toFixed(2)}
                            </span>
                          </div>
                          {formData.placement === "Council Permit" && (
                            <div className="flex justify-between mb-2 text-orange-600 border-t pt-2">
                              <span>Permit Fee (No VAT):</span>
                              <span className="font-semibold">
                                £{permitPrice.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {bookingFormType === "custom" && (
                        <>
                          <div className="flex justify-between mb-2">
                            <span>Price (Ex VAT):</span>
                            <span className="font-semibold">
                              £
                              {(
                                parseFloat(formData.customPrice) || 0
                              ).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between mb-2 text-sm text-gray-600">
                            <span>VAT @ 20%:</span>
                            <span>
                              £
                              {(
                                (parseFloat(formData.customPrice) || 0) *
                                VAT_RATE
                              ).toFixed(2)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                        <span>Total to Pay:</span>
                        <span>
                          £{calculatePricing().totalIncVat.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 text-right">
                        (Ex VAT: £{calculatePricing().totalExVat.toFixed(2)})
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            notes: e.target.value,
                          })
                        }
                        className="w-full border rounded px-3 py-2"
                        rows={3}
                      />
                    </div>
                  </>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleProceedToPayment}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
                  >
                    Proceed to Payment
                  </button>
                  <button
                    onClick={() => {
                      setShowBookingForm(false);
                      setSelectedCustomer(null);
                      setCustomerSearch("");
                    }}
                    className="px-6 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT STEP MODAL */}
      {showPaymentStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full my-8">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-2">Payment Details</h2>
              <p className="text-gray-600 mb-6">
                How will the customer pay for this booking?
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                <div className="font-semibold mb-2">
                  {selectedCustomer?.firstName} {selectedCustomer?.lastName}
                  {selectedCustomer?.company &&
                    ` (${selectedCustomer.company})`}
                </div>
                <div className="text-sm text-gray-700">
                  {bookingFormType === "custom"
                    ? formData.customSkipSize
                    : formData.skipSize}{" "}
                  Skip - Delivery: {formData.deliveryDate}
                </div>
                <div className="text-lg font-bold mt-2">
                  Total: £{calculatePricing().totalIncVat.toFixed(2)}
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    (Ex VAT: £{calculatePricing().totalExVat.toFixed(2)})
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Payment Method *
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="Card Over Phone"
                        checked={paymentMethod === "Card Over Phone"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Card Over Phone</div>
                        <div className="text-sm text-gray-600">
                          Customer paid by card during call
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="COD"
                        checked={paymentMethod === "COD"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Cash on Delivery (COD)</div>
                        <div className="text-sm text-gray-600">
                          Driver will collect payment on delivery
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="Invoice"
                        checked={paymentMethod === "Invoice"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Invoice</div>
                        <div className="text-sm text-gray-600">
                          Send invoice for payment within terms
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="Send Payment Link"
                        checked={paymentMethod === "Send Payment Link"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Send Payment Link</div>
                        <div className="text-sm text-gray-600">
                          Email customer a Stripe payment link
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="Call Back to Pay"
                        checked={paymentMethod === "Call Back to Pay"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Call Back to Pay</div>
                        <div className="text-sm text-gray-600">
                          Customer will call back later to pay by card
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {paymentMethod === "Card Over Phone" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Card Receipt Number *
                    </label>
                    <input
                      type="text"
                      value={cardReceiptNumber}
                      onChange={(e) => setCardReceiptNumber(e.target.value)}
                      placeholder="Enter receipt/transaction number"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Payment Notes (Optional)
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Any additional payment information..."
                    className="w-full border rounded px-3 py-2"
                    rows={2}
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleCreateBooking}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-semibold"
                  >
                    Confirm &amp; Create Booking
                  </button>
                  <button
                    onClick={() => setShowPaymentStep(false)}
                    className="px-6 border rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW CUSTOMER MODAL */}
      {showNewCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full my-8">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6">Add New Customer</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={newCustomer.firstName}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          firstName: e.target.value,
                        })
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={newCustomer.lastName}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          lastName: e.target.value,
                        })
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={newCustomer.company}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        company: e.target.value,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          email: e.target.value,
                        })
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          phone: e.target.value,
                        })
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Address *
                  </label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        address: e.target.value,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Postcode *
                  </label>
                  <input
                    type="text"
                    value={newCustomer.postcode}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        postcode: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleAddNewCustomer}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-semibold"
                  >
                    Add Customer
                  </button>
                  <button
                    onClick={() => setShowNewCustomerForm(false)}
                    className="px-6 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

$(document).ready(function() {
    // Fetch and display places
    function fetchPlaces() {
        $.get('/places', function(data) {
            $('#places-list').empty();
            $.each(data, function(id, place) {
                $('#places-list').append(`
                    <li class="list-group-item droppable-place" data-place-id="${id}">
                        ${place.name}
                        <ul class="allocated-products"></ul>
                        <button class="btn btn-danger btn-sm" onclick="deletePlace('${id}')">Delete</button>
                    </li>
                `);
            });
            initDragAndDrop();
        });
    }

    // Fetch and display products
    function fetchProducts() {
        console.log("Fetching products...");
        $.get('/products', function(data) {
            console.log("Received products data:", data);
            $('#products-list').empty(); // Clear the list before populating
            $.each(data, function(id, product) {
                console.log("Processing product:", id, product);
                let stockStatus = getStockStatus(product.quantity, product.ideal_quantity);
                $('#products-list').append(`
                    <li class="list-group-item d-flex justify-content-between align-items-center" data-id="${id}">
                        ${product.name}
                        <span>
                            <span class="stock-status ${stockStatus}">${product.quantity}</span>
                            /${product.ideal_quantity}
                            <button class="btn btn-danger btn-sm ml-2" onclick="deleteProduct('${id}')">Delete</button>
                        </span>
                    </li>
                `);
            });
            console.log("Finished populating products list");
        }).fail(function(jqXHR, textStatus, errorThrown) {
            console.error("Error fetching products:", textStatus, errorThrown);
        });
    }

    // Helper function to determine stock status
    function getStockStatus(current, ideal) {
        const percentage = (current / ideal) * 100;
        if (percentage <= 25) return 'danger';
        if (percentage <= 75) return 'warning';
        return 'success';
    }

    // Fetch and display low stock products
    function fetchLowStock() {
        $.get('/low_stock', function(data) {
            $('#low-stock-list').empty();
            if (Object.keys(data).length === 0) {
                $('#low-stock-list').append('<li class="list-group-item">No products are currently low in stock.</li>');
            } else {
                $.each(data, function(productName, info) {
                    const percentageStock = (info.quantity / info.ideal) * 100;
                    const stockStatus = getStockStatus(info.quantity, info.ideal);
                    $('#low-stock-list').append(`
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            ${productName}
                            <span>
                                <span class="badge badge-${stockStatus} badge-pill">${info.quantity}/${info.ideal}</span>
                                <div class="progress ml-2" style="width: 100px;">
                                    <div class="progress-bar bg-${stockStatus}" role="progressbar" style="width: ${percentageStock}%"></div>
                                </div>
                            </span>
                        </li>
                    `);
                });
            }
        });
    }

    // Modify the fetchProductOverview function
    function fetchProductOverview() {
        $.get('/places', function(placesData) {
            $.get('/product_overview', function(productsData) {
                $('#places-overview').empty();
                $('#product-overview').empty();

                // Create place boxes
                $.each(placesData, function(id, place) {
                    $('#places-overview').append(`
                        <div class="place-box" data-place-id="${id}">
                            <span class="place-name">${place.name}</span>
                            <ul class="allocated-products list-unstyled"></ul>
                        </div>
                    `);
                });

                // Populate products
                $.each(productsData, function(productName, info) {
                    const productElement = $(`
                        <li draggable="true" class="draggable-product" data-product="${productName}">
                            ${productName}
                            <span class="overview-count ${info.status}">
                                ${info.count}/${info.ideal}
                            </span>
                        </li>
                    `);

                    if (info.place === 'Unallocated') {
                        $('#product-overview').append(productElement);
                    } else {
                        $(`.place-box[data-place-id="${info.placeId}"] .allocated-products`).append(productElement);
                    }
                });

                initDragAndDrop();
            });
        });
    }

    // Initialize drag and drop
    function initDragAndDrop() {
        $('.draggable-product').on('dragstart', function(event) {
            event.originalEvent.dataTransfer.setData('text/plain', $(this).data('product'));
        });

        $('.place-box, #product-overview').on('dragover', function(event) {
            event.preventDefault();
        });

        $('.place-box').on('drop', function(event) {
            event.preventDefault();
            var productName = event.originalEvent.dataTransfer.getData('text');
            var placeId = $(this).data('place-id');
            allocateProduct(productName, placeId);
        });

        $('#product-overview').on('drop', function(event) {
            event.preventDefault();
            var productName = event.originalEvent.dataTransfer.getData('text');
            allocateProduct(productName, 'unallocate');
        });
    }

    // Allocate product to place
    function allocateProduct(productName, placeId) {
        $.post('/allocate_product', {product: productName, place: placeId}, function(response) {
            if (response.success) {
                fetchProductOverview();
            } else {
                alert('Failed to allocate product: ' + response.message);
            }
        });
    }

    // Handle place form submission
    $('#place-form').submit(function(event) {
        event.preventDefault();
        $.post('/places', $(this).serialize(), function() {
            $('#place-form')[0].reset();
            fetchPlaces();
        });
    });

    // Handle product form submission
    $('#product-form').submit(function(event) {
        event.preventDefault();
        console.log("Submitting product form...");
        $.post('/products', $(this).serialize(), function(response) {
            console.log("Product form submission response:", response);
            $('#product-form')[0].reset();
            fetchProducts();
            fetchLowStock();
            fetchProductOverview();
        }).fail(function(jqXHR, textStatus, errorThrown) {
            console.error("Error submitting product form:", textStatus, errorThrown);
        });
    });

    // Delete place
    window.deletePlace = function(id) {
        $.ajax({
            url: `/places/${id}`,
            type: 'DELETE',
            success: function() {
                fetchPlaces();
            }
        });
    };

    // Delete product
    window.deleteProduct = function(id) {
        $.ajax({
            url: `/products/${id}`,
            type: 'DELETE',
            success: function() {
                fetchProducts();
                fetchLowStock();
                fetchProductOverview();
            }
        });
    };

    // Toggle chevron icon on collapse
    $('.collapse').on('show.bs.collapse', function() {
        $(this).prev('.card-header').find('.fas').removeClass('fa-chevron-down').addClass('fa-chevron-up');
    }).on('hide.bs.collapse', function() {
        $(this).prev('.card-header').find('.fas').removeClass('fa-chevron-up').addClass('fa-chevron-down');
    });

    // Fetch data when a section is expanded
    $('#placesCollapse').on('show.bs.collapse', fetchPlaces);
    $('#productsCollapse').on('show.bs.collapse', fetchProducts);
    $('#lowStockCollapse').on('show.bs.collapse', fetchLowStock);

    // Initial fetches
    fetchProductOverview();
    fetchPlaces();
    fetchLowStock();

    // Refresh overview when products are updated
    $('#product-form').submit(function(event) {
        event.preventDefault();
        $.post('/products', $(this).serialize(), function() {
            fetchProducts();
            fetchLowStock();
            fetchProductOverview();
        });
    });

    // Refresh overview when a product is deleted
    window.deleteProduct = function(id) {
        $.ajax({
            url: `/products/${id}`,
            type: 'DELETE',
            success: function() {
                fetchProducts();
                fetchLowStock();
                fetchProductOverview();
            }
        });
    };
});